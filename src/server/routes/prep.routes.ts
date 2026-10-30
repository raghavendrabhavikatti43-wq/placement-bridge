import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma, toNumber } from '../../db/prisma.ts';
import { evaluatePreparationRoadmap, type TopicProgressState } from '../engines/preparation.ts';
import { computeSkillGap } from '../engines/skillGap.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { validateBody } from '../middleware/security.ts';
import {
  evaluateAndPersistStudentReadiness,
  loadCandidateRolesFromDb,
  loadStudentRecommendationContext,
} from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { buildPaginationMeta, parsePagination, sendSuccess } from '../utils/response.ts';

export const prepRouter = Router();

const skillGapRequestSchema = z.object({
  jobRoleId: z.string().uuid().optional(),
  companyId: z.string().trim().optional(),
  jobRoleIds: z.array(z.string().uuid()).max(20).optional(),
});

const topicProgressSchema = z.object({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']),
});

const genericBookmarkSchema = z.object({
  kind: z.enum(['RESOURCE', 'TOPIC', 'INTERVIEW_QUESTION']),
  targetId: z.string().trim().min(1).max(120),
});

// ============================================================================
// SKILL GAP ANALYZER (Part F6 & H4)
// ============================================================================
prepRouter.post(
  '/skill-gap',
  authenticate,
  requireRole('STUDENT'),
  validateBody(skillGapRequestSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [stuCtx, { roles }, resourceRows, topicRows] = await Promise.all([
      loadStudentRecommendationContext(studentId),
      loadCandidateRolesFromDb(false),
      prisma.learningResource.findMany({ where: { isActive: true } }),
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
    ]);
    if (!stuCtx) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    let selectedRoles = roles;

    if (req.body.jobRoleId) {
      selectedRoles = roles.filter((r) => r.jobRoleId === req.body.jobRoleId);
    } else if (Array.isArray(req.body.jobRoleIds) && req.body.jobRoleIds.length > 0) {
      const set = new Set(req.body.jobRoleIds);
      selectedRoles = roles.filter((r) => set.has(r.jobRoleId));
    } else if (req.body.companyId) {
      selectedRoles = roles.filter(
        (r) => r.companyId === req.body.companyId || r.companySlug === req.body.companyId
      );
    }

    if (selectedRoles.length === 0) {
      throw new AppError(404, 'ROLE_NOT_FOUND', 'Target role or company not found.');
    }

    const normalizedTopics = topicRows.map((t) => ({
      ...t,
      estimatedHours: toNumber(t.estimatedHours) ?? 2,
    }));

    const computed = computeSkillGap(
      stuCtx.skills.map((s) => ({
        id: s.skillId,
        name: s.name,
        category: s.category,
        aliases: s.aliases || [],
      })),
      selectedRoles.flatMap((r) => r.requiredSkills),
      resourceRows,
      normalizedTopics
    );

    try {
      const primaryRoleId = selectedRoles.length === 1 ? selectedRoles[0].jobRoleId : null;
      const reportRow = await prisma.skillGapReport.create({
        data: {
          studentId,
          jobRoleId: primaryRoleId,
          coveragePct: computed.coveragePct.toFixed(2),
        },
      });

      if (computed.items.length > 0) {
        await prisma.skillGapItem.createMany({
          data: computed.items.map((item) => ({
            reportId: reportRow.id,
            skillId: item.skillId,
            status: item.status,
            priority: item.priority,
          })),
          skipDuplicates: true,
        });
      }

      return sendSuccess(res, {
        reportId: reportRow.id,
        jobRoleId: primaryRoleId,
        coveragePct: computed.coveragePct,
        matchedSkills: computed.items.filter((i) => i.status === 'HAVE'),
        partialSkills: computed.items.filter((i) => i.status === 'PARTIAL'),
        missingSkills: computed.items.filter((i) => i.status === 'MISSING'),
        items: computed.items,
        roadmapTopics: computed.roadmapTopics,
      });
    } catch (err) {
      sanitizeDbError('skillGap.compute', err);
    }
  })
);

prepRouter.get(
  '/skill-gap/history',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const reports = await prisma.skillGapReport.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        jobRole: {
          include: { company: true },
        },
        items: {
          include: { skill: true },
        },
      },
    });

    return sendSuccess(
      res,
      reports.map((r) => ({
        id: r.id,
        jobRoleId: r.jobRoleId,
        coveragePct: toNumber(r.coveragePct) ?? 0,
        createdAt: r.createdAt,
        roleTitle: r.jobRole?.title ?? null,
        companyName: r.jobRole?.company.name ?? null,
        items: r.items.map((it) => ({
          reportId: it.reportId,
          skillId: it.skillId,
          skillName: it.skill.name,
          status: it.status,
          priority: it.priority,
        })),
      }))
    );
  })
);

// ============================================================================
// PREPARATION TOPICS, ROADMAP & RESOURCES (Part F7 & H5)
// ============================================================================
prepRouter.get(
  '/preparation/topics',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const categoryFilter =
      typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const diffFilter =
      typeof req.query.difficulty === 'string' ? req.query.difficulty.trim().toUpperCase() : '';
    const weekFilter = req.query.week !== undefined ? Number(req.query.week) : null;

    const [rawTopics, progRows] = await Promise.all([
      prisma.preparationTopic.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { sequenceOrder: 'asc' }],
      }),
      prisma.studentProgress.findMany({ where: { studentId } }),
    ]);

    const topics = rawTopics.map((t) => ({
      ...t,
      estimatedHours: toNumber(t.estimatedHours) ?? 2,
    }));

    const progMap: Record<string, TopicProgressState> = {};
    for (const p of progRows) {
      progMap[p.topicId] = p.status;
    }

    const evaluated = evaluatePreparationRoadmap(topics, progMap);
    const topicById = new Map(topics.map((t) => [t.id, t]));

    const filtered = evaluated.roadmap
      .map((item) => {
        const raw = topicById.get(item.id)!;
        return {
          ...raw,
          estimatedHours: raw.estimatedHours,
          status: item.status,
          locked: item.locked,
        };
      })
      .filter((t) => {
        if (categoryFilter && !t.category.toLowerCase().includes(categoryFilter)) return false;
        if (diffFilter && t.difficulty !== diffFilter) return false;
        if (weekFilter && Number.isFinite(weekFilter) && t.week !== weekFilter) return false;
        return true;
      });

    return sendSuccess(res, filtered);
  })
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

prepRouter.get(
  '/preparation/topics/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const idParam = String(req.params.id);

    const topic = await prisma.preparationTopic.findFirst({
      where: UUID_RE.test(idParam)
        ? { id: idParam }
        : { title: { equals: idParam, mode: 'insensitive' } },
    });
    if (!topic) throw new AppError(404, 'TOPIC_NOT_FOUND', 'Preparation topic not found.');

    const [resRows, rmRows, prog] = await Promise.all([
      prisma.learningResource.findMany({
        where: { topicId: topic.id, isActive: true },
      }),
      prisma.roadmapItem.findMany({
        where: { topicId: topic.id },
        orderBy: { orderNo: 'asc' },
      }),
      prisma.studentProgress.findUnique({
        where: {
          studentId_topicId: {
            studentId,
            topicId: topic.id,
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      ...topic,
      estimatedHours: toNumber(topic.estimatedHours) ?? 2,
      status: prog?.status || 'NOT_STARTED',
      startedAt: prog?.startedAt || null,
      completedAt: prog?.completedAt || null,
      resources: resRows,
      roadmapSteps: rmRows,
    });
  })
);

prepRouter.put(
  '/preparation/topics/:id/progress',
  authenticate,
  requireRole('STUDENT'),
  validateBody(topicProgressSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const idParam = String(req.params.id);
    const { status } = req.body;

    const topic = await prisma.preparationTopic.findFirst({
      where: UUID_RE.test(idParam)
        ? { id: idParam }
        : { title: { equals: idParam, mode: 'insensitive' } },
    });
    if (!topic) throw new AppError(404, 'TOPIC_NOT_FOUND', 'Preparation topic not found.');
    const topicId = topic.id;

    const now = new Date();
    const saved = await prisma.studentProgress.upsert({
      where: {
        studentId_topicId: {
          studentId,
          topicId,
        },
      },
      create: {
        studentId,
        topicId,
        status,
        startedAt: status !== 'NOT_STARTED' ? now : null,
        completedAt: status === 'COMPLETED' ? now : null,
        updatedAt: now,
      },
      update: {
        status,
        startedAt: status !== 'NOT_STARTED' ? now : null,
        completedAt: status === 'COMPLETED' ? now : null,
        updatedAt: now,
      },
    });

    if (status === 'COMPLETED') {
      await prisma.learningActivityLog.create({
        data: {
          studentId,
          type: 'TOPIC_COMPLETED',
          refId: topicId,
          metadata: { title: topic.title, category: topic.category } as Prisma.InputJsonValue,
        },
      });
    }

    const readiness = await evaluateAndPersistStudentReadiness(
      studentId,
      status === 'COMPLETED'
    );

    return sendSuccess(
      res,
      { progress: saved, readinessOverall: readiness.overall },
      'Progress updated'
    );
  })
);

prepRouter.get(
  '/preparation/roadmap',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [rawTopics, progRows, readiness] = await Promise.all([
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
      prisma.studentProgress.findMany({ where: { studentId } }),
      evaluateAndPersistStudentReadiness(studentId, false),
    ]);

    const topics = rawTopics.map((t) => ({
      ...t,
      estimatedHours: toNumber(t.estimatedHours) ?? 2,
    }));

    const progMap: Record<string, TopicProgressState> = {};
    for (const p of progRows) progMap[p.topicId] = p.status;

    const prioCats = [...readiness.weakAreas, ...readiness.missing];
    const evaluated = evaluatePreparationRoadmap(topics, progMap, prioCats);

    return sendSuccess(res, evaluated);
  })
);

prepRouter.get(
  '/preparation/next',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [rawTopics, progRows, readiness] = await Promise.all([
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
      prisma.studentProgress.findMany({ where: { studentId } }),
      evaluateAndPersistStudentReadiness(studentId, false),
    ]);

    const topics = rawTopics.map((t) => ({
      ...t,
      estimatedHours: toNumber(t.estimatedHours) ?? 2,
    }));

    const progMap: Record<string, TopicProgressState> = {};
    for (const p of progRows) progMap[p.topicId] = p.status;

    const evaluated = evaluatePreparationRoadmap(topics, progMap, [
      ...readiness.weakAreas,
      ...readiness.missing,
    ]);
    return sendSuccess(res, {
      nextTopic: evaluated.nextRecommended,
      completedCount: evaluated.completedCount,
      totalCount: evaluated.totalCount,
    });
  })
);

prepRouter.get(
  '/resources',
  optionalAuthenticate,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(
      req.query as Record<string, unknown>,
      25,
      100
    );
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const typeFilter =
      typeof req.query.type === 'string' ? req.query.type.trim().toUpperCase() : '';
    const skillId = typeof req.query.skillId === 'string' ? req.query.skillId.trim() : '';
    const topicId = typeof req.query.topicId === 'string' ? req.query.topicId.trim() : '';
    const categoryLabel =
      typeof req.query.categoryLabel === 'string'
        ? req.query.categoryLabel.trim().toLowerCase()
        : '';

    const rows = await prisma.learningResource.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const filtered = rows.filter((r) => {
      if (typeFilter && r.type !== typeFilter) return false;
      if (skillId && r.skillId !== skillId) return false;
      if (topicId && r.topicId !== topicId) return false;
      if (categoryLabel && !(r.categoryLabel || '').toLowerCase().includes(categoryLabel)) {
        return false;
      }
      if (q) {
        const hay = `${r.title} ${r.summary || ''} ${r.categoryLabel || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + pageSize);
    return sendSuccess(
      res,
      paged,
      'Resources retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

prepRouter.get(
  '/bookmarks/items',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.bookmark.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, rows);
  })
);

prepRouter.post(
  '/bookmarks/items',
  authenticate,
  requireRole('STUDENT'),
  validateBody(genericBookmarkSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const saved = await prisma.bookmark.upsert({
      where: {
        studentId_kind_targetId: {
          studentId,
          kind: req.body.kind,
          targetId: req.body.targetId,
        },
      },
      create: {
        studentId,
        kind: req.body.kind,
        targetId: req.body.targetId,
      },
      update: {
        createdAt: new Date(),
      },
    });
    return sendSuccess(res, saved, 'Bookmark saved', 201);
  })
);

prepRouter.delete(
  '/bookmarks/items/:id',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const deleted = await prisma.bookmark.deleteMany({
      where: {
        id: String(req.params.id),
        studentId: req.auth!.studentId!,
      },
    });
    if (deleted.count === 0) {
      throw new AppError(404, 'BOOKMARK_NOT_FOUND', 'Bookmark not found.');
    }
    return sendSuccess(res, { deleted: true }, 'Bookmark deleted');
  })
);
