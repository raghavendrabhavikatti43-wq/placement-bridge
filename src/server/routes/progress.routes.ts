import { Router } from 'express';
import { prisma, toNumber } from '../../db/prisma.ts';
import { evaluatePreparationRoadmap, type TopicProgressState } from '../engines/preparation.ts';
import { computeRecommendations } from '../engines/recommendation.ts';
import {
  authenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import {
  evaluateAndPersistStudentReadiness,
  loadCandidateRolesFromDb,
  loadStudentFrontendApplications,
  loadStudentFrontendSkillGaps,
  loadStudentFullContext,
  loadStudentStudyModules,
  mapCompaniesToFrontendDrives,
} from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { buildPaginationMeta, parsePagination, sendSuccess } from '../utils/response.ts';

export const progressRouter = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// PROGRESS OVERVIEW, WEEKLY/MONTHLY SQL AGGREGATION & BADGES (Part F13 & H8)
// ============================================================================
progressRouter.get(
  '/progress/overview',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [
      profile,
      totalTopics,
      completedTopicsCount,
      attemptsRows,
      codingRows,
      interviewRows,
      earnedBadgesCount,
    ] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: studentId } }),
      prisma.preparationTopic.count({ where: { isActive: true } }),
      prisma.studentProgress.count({
        where: { studentId, status: 'COMPLETED' },
      }),
      prisma.quizAttempt.findMany({ where: { studentId } }),
      prisma.codingSubmission.findMany({ where: { studentId } }),
      prisma.interviewSession.findMany({ where: { studentId } }),
      prisma.studentBadge.count({ where: { studentId } }),
    ]);

    const completedQuizzes = attemptsRows.filter(
      (a) => a.status === 'SUBMITTED' || a.status === 'EXPIRED'
    );
    const solvedCodingIds = new Set(
      codingRows
        .filter((c) => c.status === 'PASSED' || c.status === 'SELF_MARKED_SOLVED')
        .map((c) => c.problemId)
    );
    const completedInterviews = interviewRows.filter((i) => Boolean(i.completedAt));

    return sendSuccess(res, {
      completionPct: profile?.completionPct ?? 0,
      topicsCompleted: completedTopicsCount,
      topicsTotal: totalTopics,
      quizzesCompleted: completedQuizzes.length,
      codingProblemsSolved: solvedCodingIds.size,
      totalCodingSubmissions: codingRows.length,
      interviewsCompleted: completedInterviews.length,
      badgesEarned: earnedBadgesCount,
    });
  })
);

progressRouter.get(
  '/progress/weekly',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    try {
      const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT
          date_trunc('day', created_at) AS bucket,
          type,
          COUNT(*)::int AS count
        FROM learning_activity_logs
        WHERE student_id = ${studentId}::uuid
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY bucket, type
        ORDER BY bucket ASC
      `;
      return sendSuccess(res, rows);
    } catch (err) {
      sanitizeDbError('progress.weekly', err);
    }
  })
);

progressRouter.get(
  '/progress/monthly',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    try {
      const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT
          date_trunc('week', created_at) AS bucket,
          type,
          COUNT(*)::int AS count
        FROM learning_activity_logs
        WHERE student_id = ${studentId}::uuid
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY bucket, type
        ORDER BY bucket ASC
      `;
      return sendSuccess(res, rows);
    } catch (err) {
      sanitizeDbError('progress.monthly', err);
    }
  })
);

progressRouter.get(
  '/progress/categories',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [topics, progRows] = await Promise.all([
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
      prisma.studentProgress.findMany({ where: { studentId } }),
    ]);

    const completedSet = new Set(
      progRows.filter((p) => p.status === 'COMPLETED').map((p) => p.topicId)
    );
    const catStats: Record<string, { completed: number; total: number; pct: number }> = {};

    for (const t of topics) {
      if (!catStats[t.category]) catStats[t.category] = { completed: 0, total: 0, pct: 0 };
      catStats[t.category].total += 1;
      if (completedSet.has(t.id)) catStats[t.category].completed += 1;
    }

    for (const stat of Object.values(catStats)) {
      stat.pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
    }

    return sendSuccess(res, catStats);
  })
);

progressRouter.get(
  '/progress/activity',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 25, 100);
    const rows = await prisma.learningActivityLog.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { createdAt: 'desc' },
    });

    const total = rows.length;
    const paged = rows.slice(offset, offset + pageSize);
    return sendSuccess(
      res,
      paged,
      'Activity feed retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

progressRouter.get(
  '/progress/badges',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    await evaluateAndPersistStudentReadiness(studentId, false);

    const [allBadges, earnedRows] = await Promise.all([
      prisma.badge.findMany({ orderBy: { code: 'asc' } }),
      prisma.studentBadge.findMany({ where: { studentId } }),
    ]);

    const earnedMap = new Map(earnedRows.map((e) => [e.badgeId, e.earnedAt]));
    return sendSuccess(
      res,
      allBadges.map((b) => ({
        ...b,
        earned: earnedMap.has(b.id),
        earnedAt: earnedMap.get(b.id) || null,
      }))
    );
  })
);

// ============================================================================
// PLACEMENT READINESS ENGINE & SNAPSHOTS (Part F14 & H7)
// ============================================================================
progressRouter.get(
  '/readiness',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const readiness = await evaluateAndPersistStudentReadiness(studentId, false);
    return sendSuccess(res, readiness);
  })
);

progressRouter.post(
  '/readiness/recalculate',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const readiness = await evaluateAndPersistStudentReadiness(studentId, true);
    return sendSuccess(res, readiness, 'Readiness recalculated and snapshot saved');
  })
);

progressRouter.get(
  '/readiness/history',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.readinessSnapshot.findMany({
      where: { studentId: req.auth!.studentId! },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return sendSuccess(
      res,
      rows.map((r) => ({
        ...r,
        overall: toNumber(r.overall) ?? 0,
        academics: toNumber(r.academics),
        technical: toNumber(r.technical),
        aptitude: toNumber(r.aptitude),
        coding: toNumber(r.coding),
        interview: toNumber(r.interview),
        projects: toNumber(r.projects),
      }))
    );
  })
);

// ============================================================================
// SINGLE AGGREGATED STUDENT DASHBOARD PAYLOAD (Part F14)
// ============================================================================
progressRouter.get(
  '/dashboard',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const ctx = await loadStudentFullContext(studentId);
    if (!ctx) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    const [
      { roles },
      rawTopics,
      progRows,
      recentActivity,
      unreadNotificationsCount,
      publishedAnnouncements,
      frontendApps,
    ] = await Promise.all([
      loadCandidateRolesFromDb(false),
      prisma.preparationTopic.findMany({ where: { isActive: true } }),
      prisma.studentProgress.findMany({ where: { studentId } }),
      prisma.learningActivityLog.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.notification.count({
        where: {
          userId: req.auth!.userId,
          isRead: false,
          archivedAt: null,
        },
      }),
      prisma.announcement.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      loadStudentFrontendApplications(studentId),
    ]);

    const recCtx = {
      profile: {
        id: ctx.profile.id,
        userId: ctx.profile.userId,
        fullName: ctx.profile.fullName,
        department: ctx.profile.department,
        graduationYear: ctx.profile.graduationYear,
        cgpa: ctx.profile.cgpa,
        tenthPct: ctx.profile.tenthPct,
        twelfthPct: ctx.profile.twelfthPct,
        diplomaPct: ctx.profile.diplomaPct,
        activeBacklogs: ctx.profile.activeBacklogs,
        totalBacklogs: ctx.profile.totalBacklogs,
      },
      skills: ctx.skills,
      projects: ctx.projects,
      certifications: ctx.certifications,
    };

    const [frontendDrives, frontendModules, frontendGaps] = await Promise.all([
      mapCompaniesToFrontendDrives(studentId, { roles, recCtx }),
      loadStudentStudyModules(studentId, { topics: rawTopics, progRows }),
      loadStudentFrontendSkillGaps(studentId, { recCtx, roles, topicsRows: rawTopics }),
    ]);

    const recOut = computeRecommendations(
      {
        academics: {
          cgpa: ctx.profile.cgpa,
          tenthPct: ctx.profile.tenthPct,
          twelfthPct: ctx.profile.twelfthPct,
          diplomaPct: ctx.profile.diplomaPct,
          department: ctx.profile.department,
          activeBacklogs: ctx.profile.activeBacklogs,
          totalBacklogs: ctx.profile.totalBacklogs,
          graduationYear: ctx.profile.graduationYear,
        },
        skills: ctx.skills.map((s) => ({
          id: s.skillId,
          name: s.name,
          category: s.category,
          aliases: s.aliases || [],
        })),
        projects: ctx.projects.map((p) => ({
          title: p.title,
          description: p.description,
          technologies: p.technologies || [],
        })),
        certifications: ctx.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer,
        })),
      },
      roles
    );

    const topics = rawTopics.map((t) => ({
      ...t,
      estimatedHours: toNumber(t.estimatedHours) ?? 2,
    }));

    const progMap: Record<string, TopicProgressState> = {};
    for (const p of progRows) progMap[p.topicId] = p.status;
    const roadmapEval = evaluatePreparationRoadmap(topics, progMap, [
      ...ctx.readiness.weakAreas,
      ...ctx.readiness.missing,
    ]);

    return sendSuccess(res, {
      profile: ctx.profile,
      frontendProfile: ctx.frontendProfile,
      completion: ctx.completion,
      readiness: ctx.readiness,
      topRecommendations: recOut.items.slice(0, 5),
      nextRecommendedTopic: roadmapEval.nextRecommended,
      recentActivity,
      unreadNotificationsCount,
      announcements: publishedAnnouncements,
      companies: frontendDrives,
      applications: frontendApps,
      studyModules: frontendModules,
      skillGaps: frontendGaps,
      portalSettings: ctx.portalSettings,
    });
  })
);

// ============================================================================
// NOTIFICATIONS & PUBLISHED ANNOUNCEMENTS (Part F16)
// ============================================================================
progressRouter.get(
  '/notifications',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 25, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    const rows = await prisma.notification.findMany({
      where: {
        userId: req.auth!.userId,
        archivedAt: null,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = rows.length;
    const paged = rows.slice(offset, offset + pageSize);

    return sendSuccess(
      res,
      paged,
      'Notifications retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

progressRouter.put(
  '/notifications/:id/read',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.auth!.userId },
    });
    if (!existing) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return sendSuccess(res, updated, 'Marked as read');
  })
);

progressRouter.put(
  '/notifications/read-all',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.auth!.userId },
      data: { isRead: true },
    });
    return sendSuccess(res, { updated: true }, 'All notifications marked as read');
  })
);

progressRouter.put(
  '/notifications/:id/archive',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.auth!.userId },
    });
    if (!existing) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');

    const updated = await prisma.notification.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return sendSuccess(res, updated, 'Notification archived');
  })
);

progressRouter.get(
  '/announcements',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.announcement.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (req.auth!.role === 'ADMIN' || !req.auth!.studentId) {
      return sendSuccess(res, rows);
    }

    const stu = await prisma.studentProfile.findUnique({
      where: { id: req.auth!.studentId },
    });

    const filtered = rows.filter((ann) => {
      const aud = (ann.audience || {}) as {
        departments?: string[];
        graduationYears?: number[];
      };
      if (Array.isArray(aud.departments) && aud.departments.length > 0 && stu?.department) {
        const hit = aud.departments.some((d) =>
          stu.department!.toLowerCase().includes(d.toLowerCase())
        );
        if (!hit) return false;
      }
      if (
        Array.isArray(aud.graduationYears) &&
        aud.graduationYears.length > 0 &&
        stu?.graduationYear
      ) {
        if (!aud.graduationYears.includes(stu.graduationYear)) return false;
      }
      return true;
    });

    return sendSuccess(res, filtered);
  })
);
