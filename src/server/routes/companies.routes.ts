import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma, Prisma, toNumber } from '../../db/prisma.ts';
import { evaluateEligibility } from '../engines/eligibility.ts';
import { computeRecommendations } from '../engines/recommendation.ts';
import {
  authenticate,
  optionalAuthenticate,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { validateBody } from '../middleware/security.ts';
import {
  loadCandidateRolesFromDb,
  loadStudentFrontendApplications,
  loadStudentRecommendationContext,
} from '../services/studentDataService.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { buildPaginationMeta, parsePagination, sendSuccess } from '../utils/response.ts';

export const companiesRouter = Router();

const eligibilityCheckSchema = z.object({
  jobRoleId: z.string().uuid().optional(),
  companyId: z.string().trim().min(1).optional(),
  all: z.boolean().optional(),
});

const recommendationFeedbackSchema = z.object({
  helpful: z.boolean(),
  comment: z.string().trim().max(1000).optional(),
});

const createApplicationSchema = z.object({
  companyId: z.string().trim().min(1),
  jobRoleId: z.string().uuid().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateApplicationSchema = z.object({
  status: z.enum(['Applied', 'OA Scheduled', 'Shortlisted', 'Tech Round', 'Offer']).optional(),
  round: z.string().trim().max(140).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCompanyRow(idOrSlug: string) {
  const isUuid = UUID_REGEX.test(idOrSlug);
  return prisma.company.findFirst({
    where: isUuid ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] } : { slug: idOrSlug },
  });
}

// ============================================================================
// COMPANIES EXPLORATION & BOOKMARKS (Part F3)
// ============================================================================
companiesRouter.get(
  '/companies',
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { page, pageSize, offset } = parsePagination(
      req.query as Record<string, unknown>,
      20,
      100
    );
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const industry =
      typeof req.query.industry === 'string' ? req.query.industry.trim().toLowerCase() : '';
    const roleFilter =
      typeof req.query.role === 'string' ? req.query.role.trim().toLowerCase() : '';
    const minCgpaMax =
      req.query.minCgpa !== undefined && req.query.minCgpa !== ''
        ? Number(req.query.minCgpa)
        : null;
    const eligibleForMe = req.query.eligibleForMe === 'true';
    const sortKey =
      typeof req.query.sort === 'string' &&
      ['name', 'daysRemaining', 'minCgpa', 'matchScore'].includes(req.query.sort)
        ? req.query.sort
        : 'daysRemaining';

    const studentId = req.auth?.role === 'STUDENT' ? req.auth.studentId : undefined;
    const [{ roles }, stuCtx, bookmarkRows] = await Promise.all([
      loadCandidateRolesFromDb(false),
      studentId ? loadStudentRecommendationContext(studentId) : Promise.resolve(null),
      studentId ? prisma.companyBookmark.findMany({ where: { studentId } }) : Promise.resolve([]),
    ]);

    const bookmarkedIds = new Set<string>(bookmarkRows.map((b) => b.companyId));

    const recMap = new Map<string, ReturnType<typeof computeRecommendations>['items'][number]>();
    if (stuCtx) {
      const recOut = computeRecommendations(
        {
          academics: {
            cgpa: stuCtx.profile.cgpa,
            tenthPct: stuCtx.profile.tenthPct,
            twelfthPct: stuCtx.profile.twelfthPct,
            diplomaPct: stuCtx.profile.diplomaPct,
            department: stuCtx.profile.department,
            activeBacklogs: stuCtx.profile.activeBacklogs,
            totalBacklogs: stuCtx.profile.totalBacklogs,
            graduationYear: stuCtx.profile.graduationYear,
          },
          skills: stuCtx.skills.map((s) => ({
            id: s.skillId,
            name: s.name,
            category: s.category,
            aliases: s.aliases || [],
          })),
          projects: stuCtx.projects.map((p) => ({
            title: p.title,
            description: p.description,
            technologies: p.technologies || [],
          })),
          certifications: stuCtx.certifications.map((c) => ({
            name: c.name,
            issuer: c.issuer,
          })),
        },
        roles
      );
      for (const item of recOut.items) {
        recMap.set(item.jobRoleId, item);
      }
    }

    const grouped = new Map<
      string,
      {
        id: string;
        slug: string | null;
        name: string;
        logoIcon: string;
        category: string;
        industry: string | null;
        location: string;
        website: string | null;
        description: string | null;
        packageInfo: string;
        driveDate: string;
        daysRemaining: number;
        institutionalNotes: string;
        dataStatus: 'SAMPLE' | 'VERIFIED';
        bookmarked: boolean;
        minCgpa: number | null;
        allowedBranches: string[];
        maxActiveBacklogs: number | null;
        eligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'INSUFFICIENT_INFO' | null;
        matchScore: number | null;
        matchedSkills: string[];
        missingSkills: string[];
        stages: { id: string; stageOrder: number; name: string; description: string | null }[];
        roles: {
          id: string;
          title: string;
          packageInfo: string;
          requirement: unknown;
          requiredSkills: {
            id: string;
            name: string;
            category: string;
            importance: 'MUST' | 'GOOD';
          }[];
        }[];
      }
    >();

    for (const r of roles) {
      const rec = recMap.get(r.jobRoleId);
      const existing = grouped.get(r.companyId);
      const roleEntry = {
        id: r.jobRoleId,
        title: r.roleTitle,
        packageInfo: r.packageInfo,
        requirement: r.requirement,
        requiredSkills: r.requiredSkills.map((sk) => ({
          id: sk.id,
          name: sk.name,
          category: sk.category,
          importance: sk.importance,
        })),
      };

      if (!existing) {
        grouped.set(r.companyId, {
          id: r.companyId,
          slug: r.companySlug,
          name: r.companyName,
          logoIcon: r.logoIcon,
          category: r.category,
          industry: r.industry,
          location: r.location,
          website: r.website,
          description: r.description,
          packageInfo: r.packageInfo,
          driveDate: r.driveDate,
          daysRemaining: r.daysRemaining,
          institutionalNotes: r.institutionalNotes,
          dataStatus: r.dataStatus,
          bookmarked: bookmarkedIds.has(r.companyId),
          minCgpa: r.requirement?.minCgpa ?? null,
          allowedBranches: r.requirement?.allowedBranches ?? [],
          maxActiveBacklogs: r.requirement?.maxActiveBacklogs ?? null,
          eligibility: rec?.eligibility ?? null,
          matchScore: rec?.matchScore ?? null,
          matchedSkills: rec?.matchingSkills ?? [],
          missingSkills: rec?.missingSkills ?? [],
          stages: r.stages,
          roles: [roleEntry],
        });
      } else {
        existing.roles.push(roleEntry);
        if (rec && (existing.matchScore === null || rec.matchScore > existing.matchScore)) {
          existing.matchScore = rec.matchScore;
          existing.eligibility = rec.eligibility;
          existing.matchedSkills = rec.matchingSkills;
          existing.missingSkills = rec.missingSkills;
        }
      }
    }

    const items = Array.from(grouped.values()).filter((comp) => {
      if (q) {
        const hay = `${comp.name} ${comp.industry || ''} ${comp.category} ${comp.roles
          .map((r) => `${r.title} ${r.requiredSkills.map((s) => s.name).join(' ')}`)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (industry && !(comp.industry || comp.category).toLowerCase().includes(industry)) {
        return false;
      }
      if (roleFilter && !comp.roles.some((r) => r.title.toLowerCase().includes(roleFilter))) {
        return false;
      }
      if (
        minCgpaMax !== null &&
        Number.isFinite(minCgpaMax) &&
        comp.minCgpa !== null &&
        comp.minCgpa > minCgpaMax
      ) {
        return false;
      }
      if (eligibleForMe && stuCtx && comp.eligibility !== 'ELIGIBLE') {
        return false;
      }
      return true;
    });

    items.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'minCgpa') return (a.minCgpa ?? 0) - (b.minCgpa ?? 0);
      if (sortKey === 'matchScore') return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      return a.daysRemaining - b.daysRemaining;
    });

    const total = items.length;
    const paged = items.slice(offset, offset + pageSize);

    return sendSuccess(
      res,
      paged,
      'Companies retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

companiesRouter.get(
  '/companies/:id',
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const idParam = String(req.params.id);
    const comp = await resolveCompanyRow(idParam);
    if (!comp || !comp.isActive) {
      throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
    }

    const { roles } = await loadCandidateRolesFromDb(false);
    const compRoles = roles.filter((r) => r.companyId === comp.id);

    let studentEligibility = null;
    if (req.auth?.role === 'STUDENT' && req.auth.studentId && compRoles[0]) {
      const stuCtx = await loadStudentRecommendationContext(req.auth.studentId);
      if (stuCtx) {
        studentEligibility = evaluateEligibility(
          {
            cgpa: stuCtx.profile.cgpa,
            tenthPct: stuCtx.profile.tenthPct,
            twelfthPct: stuCtx.profile.twelfthPct,
            diplomaPct: stuCtx.profile.diplomaPct,
            department: stuCtx.profile.department,
            activeBacklogs: stuCtx.profile.activeBacklogs,
            totalBacklogs: stuCtx.profile.totalBacklogs,
            graduationYear: stuCtx.profile.graduationYear,
          },
          compRoles[0].requirement
        );
      }
    }

    return sendSuccess(res, {
      ...comp,
      dataStatus: comp.dataStatus,
      stages: compRoles[0]?.stages || [],
      roles: compRoles.map((r) => ({
        id: r.jobRoleId,
        title: r.roleTitle,
        packageInfo: r.packageInfo,
        requirement: r.requirement,
        requiredSkills: r.requiredSkills,
      })),
      studentEligibility,
    });
  })
);

companiesRouter.get(
  '/bookmarks/companies',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rows = await prisma.companyBookmark.findMany({
      where: { studentId: req.auth!.studentId! },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(
      res,
      rows.map((r) => ({
        companyId: r.company.id,
        slug: r.company.slug,
        name: r.company.name,
        industry: r.company.industry,
        packageInfo: r.company.packageInfo,
        dataStatus: r.company.dataStatus,
        bookmarkedAt: r.createdAt,
      }))
    );
  })
);

companiesRouter.post(
  '/bookmarks/companies/:companyId',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const comp = await resolveCompanyRow(String(req.params.companyId));
    if (!comp) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
    const studentId = req.auth!.studentId!;
    await prisma.companyBookmark.upsert({
      where: {
        studentId_companyId: {
          studentId,
          companyId: comp.id,
        },
      },
      create: { studentId, companyId: comp.id },
      update: {},
    });
    return sendSuccess(res, { companyId: comp.id, bookmarked: true }, 'Company bookmarked', 201);
  })
);

companiesRouter.delete(
  '/bookmarks/companies/:companyId',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const comp = await resolveCompanyRow(String(req.params.companyId));
    if (comp) {
      await prisma.companyBookmark.deleteMany({
        where: {
          studentId: req.auth!.studentId!,
          companyId: comp.id,
        },
      });
    }
    return sendSuccess(res, { bookmarked: false }, 'Bookmark removed');
  })
);

// ============================================================================
// STUDENT DRIVE APPLICATIONS TRACKER
// ============================================================================
companiesRouter.get(
  '/applications',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const apps = await loadStudentFrontendApplications(req.auth!.studentId!);
    return sendSuccess(res, apps);
  })
);

companiesRouter.post(
  '/applications',
  authenticate,
  requireRole('STUDENT'),
  validateBody(createApplicationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const comp = await resolveCompanyRow(req.body.companyId);
    if (!comp) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Campus drive not found.');

    const roleRow = req.body.jobRoleId
      ? await prisma.jobRole.findUnique({ where: { id: req.body.jobRoleId } })
      : await prisma.jobRole.findFirst({ where: { companyId: comp.id } });

    const appRow = await prisma.driveApplication.upsert({
      where: {
        studentId_companyId: {
          studentId,
          companyId: comp.id,
        },
      },
      create: {
        studentId,
        companyId: comp.id,
        jobRoleId: roleRow?.id ?? null,
        status: 'Applied',
        round: '1. Initial Screening',
        notes: req.body.notes || `Submitted via Placement Bridge portal.`,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    const apps = await loadStudentFrontendApplications(studentId);
    const matched = apps.find((a) => a.id === appRow.id) || apps[0];
    return sendSuccess(res, matched, 'Application recorded', 201);
  })
);

companiesRouter.put(
  '/applications/:id',
  authenticate,
  requireRole('STUDENT'),
  validateBody(updateApplicationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const id = String(req.params.id);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }
    const existing = await prisma.driveApplication.findFirst({
      where: { id, studentId },
    });
    if (!existing) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    const updated = await prisma.driveApplication.update({
      where: { id },
      data: {
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.round !== undefined ? { round: req.body.round } : {}),
        ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
        updatedAt: new Date(),
      },
    });
    return sendSuccess(res, updated, 'Application updated');
  })
);

// ============================================================================
// ELIGIBILITY CHECKER ENGINE (Part F4 & H2)
// ============================================================================
companiesRouter.post(
  '/eligibility/check',
  authenticate,
  requireRole('STUDENT'),
  validateBody(eligibilityCheckSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [profileRow, { roles }] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: studentId } }),
      loadCandidateRolesFromDb(false),
    ]);
    if (!profileRow) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

    let targetRoles = roles;

    if (req.body.jobRoleId) {
      targetRoles = roles.filter((r) => r.jobRoleId === req.body.jobRoleId);
    } else if (req.body.companyId) {
      const comp = await resolveCompanyRow(req.body.companyId);
      if (!comp) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
      targetRoles = roles.filter((r) => r.companyId === comp.id);
    } else if (req.body.all === false) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Provide jobRoleId, companyId, or { all: true }.'
      );
    }

    if (targetRoles.length === 0) {
      throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'No matching active job roles found.');
    }

    const academics = {
      cgpa: toNumber(profileRow.cgpa),
      tenthPct: toNumber(profileRow.tenthPct),
      twelfthPct: toNumber(profileRow.twelfthPct),
      diplomaPct: toNumber(profileRow.diplomaPct),
      department: profileRow.department,
      activeBacklogs: profileRow.activeBacklogs,
      totalBacklogs: profileRow.totalBacklogs,
      graduationYear: profileRow.graduationYear,
    };

    try {
      const checkedAt = new Date();
      const checksToInsert: Prisma.EligibilityCheckCreateManyInput[] = [];
      const resultsToInsert: Prisma.EligibilityCheckResultCreateManyInput[] = [];

      const checksOutput = targetRoles.map((role) => {
        const evalResult = evaluateEligibility(academics, role.requirement);
        const checkId = crypto.randomUUID();
        checksToInsert.push({
          id: checkId,
          studentId,
          jobRoleId: role.jobRoleId,
          status: evalResult.status,
          dataStatus: role.dataStatus,
          checkedAt,
        });

        for (const cr of evalResult.results) {
          resultsToInsert.push({
            checkId,
            criterion: cr.criterion,
            studentValue: cr.studentValue !== null ? String(cr.studentValue) : null,
            requiredValue: cr.requiredValue !== null ? String(cr.requiredValue) : null,
            status: cr.status,
            explanation: cr.explanation,
          });
        }

        return {
          checkId,
          checkedAt,
          companyId: role.companyId,
          companyName: role.companyName,
          jobRoleId: role.jobRoleId,
          roleTitle: role.roleTitle,
          dataStatus: role.dataStatus,
          status: evalResult.status,
          missingFields: evalResult.missingFields,
          results: evalResult.results,
        };
      });

      await prisma.eligibilityCheck.createMany({ data: checksToInsert });
      if (resultsToInsert.length > 0) {
        await prisma.eligibilityCheckResult.createMany({ data: resultsToInsert });
      }
      await prisma.learningActivityLog.create({
        data: {
          studentId,
          type: 'ELIGIBILITY_CHECKED',
          refId: checksOutput[0]?.checkId,
          metadata: { count: checksOutput.length } as Prisma.InputJsonValue,
        },
      });

      const isBatchCheck = Boolean(req.body.all) || (!req.body.jobRoleId && !req.body.companyId);
      return sendSuccess(
        res,
        isBatchCheck
          ? {
              checks: checksOutput,
              summary: {
                totalEvaluated: checksOutput.length,
                eligibleCount: checksOutput.filter((c) => c.status === 'ELIGIBLE').length,
              },
            }
          : checksOutput[0],
        'Eligibility evaluated'
      );
    } catch (err) {
      sanitizeDbError('eligibility.check', err);
    }
  })
);

companiesRouter.get(
  '/eligibility/history',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const { page, pageSize, offset } = parsePagination(
      req.query as Record<string, unknown>,
      20,
      100
    );

    try {
      const [total, pageItems] = await Promise.all([
        prisma.eligibilityCheck.count({ where: { studentId } }),
        prisma.eligibilityCheck.findMany({
          where: { studentId },
          orderBy: { checkedAt: 'desc' },
          skip: offset,
          take: pageSize,
          include: {
            results: true,
            jobRole: {
              include: { company: true },
            },
          },
        }),
      ]);

      const enriched = pageItems.map((item) => ({
        id: item.id,
        jobRoleId: item.jobRoleId,
        status: item.status,
        dataStatus: item.dataStatus,
        checkedAt: item.checkedAt,
        roleTitle: item.jobRole.title,
        companyId: item.jobRole.company.id,
        companyName: item.jobRole.company.name,
        results: item.results,
      }));

      return sendSuccess(
        res,
        enriched,
        'Eligibility history retrieved',
        200,
        buildPaginationMeta(page, pageSize, total)
      );
    } catch (err) {
      sanitizeDbError('eligibility.history', err);
    }
  })
);

// ============================================================================
// RULE-BASED RECOMMENDATION ENGINE (Part F5 & H3 — Never described as ML)
// ============================================================================
async function executeAndPersistRecommendations(studentId: string) {
  const [stuCtx, { roles }] = await Promise.all([
    loadStudentRecommendationContext(studentId),
    loadCandidateRolesFromDb(false),
  ]);
  if (!stuCtx) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Student profile not found.');

  const computed = computeRecommendations(
    {
      academics: {
        cgpa: stuCtx.profile.cgpa,
        tenthPct: stuCtx.profile.tenthPct,
        twelfthPct: stuCtx.profile.twelfthPct,
        diplomaPct: stuCtx.profile.diplomaPct,
        department: stuCtx.profile.department,
        activeBacklogs: stuCtx.profile.activeBacklogs,
        totalBacklogs: stuCtx.profile.totalBacklogs,
        graduationYear: stuCtx.profile.graduationYear,
      },
      skills: stuCtx.skills.map((s) => ({
        id: s.skillId,
        name: s.name,
        category: s.category,
        aliases: s.aliases || [],
      })),
      projects: stuCtx.projects.map((p) => ({
        title: p.title,
        description: p.description,
        technologies: p.technologies || [],
      })),
      certifications: stuCtx.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer,
      })),
    },
    roles
  );

  const runRow = await prisma.recommendationRun.create({
    data: {
      studentId,
      coverageNote: computed.coverageNote,
    },
  });

  const idByRole = new Map<string, string>();
  if (computed.items.length > 0) {
    const recRows = computed.items.map((item) => {
      const id = crypto.randomUUID();
      idByRole.set(item.jobRoleId, id);
      return {
        id,
        runId: runRow.id,
        jobRoleId: item.jobRoleId,
        matchScore: item.matchScore.toFixed(2),
        academicScore: (item.academicScore ?? 0).toFixed(2),
        skillScore: (item.skillScore ?? 0).toFixed(2),
        branchScore: (item.branchScore ?? 0).toFixed(2),
        projectScore: (item.projectScore ?? 0).toFixed(2),
        certScore: (item.certScore ?? 0).toFixed(2),
        matchingSkills: item.matchingSkills,
        missingSkills: item.missingSkills,
        eligibility: item.eligibility,
        explanation: item.explanation,
        rank: item.rank,
      };
    });
    await prisma.companyRecommendation.createMany({ data: recRows });
  }

  return {
    runId: runRow.id,
    createdAt: runRow.createdAt,
    engineType: 'DETERMINISTIC_RULE_BASED',
    coverageNote: computed.coverageNote,
    recommendations: computed.items.map((item) => ({
      id: idByRole.get(item.jobRoleId) || item.jobRoleId,
      ...item,
    })),
  };
}

companiesRouter.post(
  '/recommendations/run',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload = await executeAndPersistRecommendations(req.auth!.studentId!);
    return sendSuccess(res, payload, 'Rule-based recommendations computed');
  })
);

companiesRouter.get(
  '/recommendations/latest',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const latestRun = await prisma.recommendationRun.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { rank: 'asc' },
          include: {
            jobRole: {
              include: { company: true },
            },
          },
        },
      },
    });

    if (!latestRun) {
      const generated = await executeAndPersistRecommendations(studentId);
      return sendSuccess(res, generated);
    }

    return sendSuccess(res, {
      runId: latestRun.id,
      createdAt: latestRun.createdAt,
      engineType: 'DETERMINISTIC_RULE_BASED',
      coverageNote: latestRun.coverageNote,
      recommendations: latestRun.items.map((r) => ({
        id: r.id,
        jobRoleId: r.jobRoleId,
        matchScore: toNumber(r.matchScore) ?? 0,
        academicScore: toNumber(r.academicScore) ?? 0,
        skillScore: toNumber(r.skillScore) ?? 0,
        branchScore: toNumber(r.branchScore) ?? 0,
        projectScore: toNumber(r.projectScore) ?? 0,
        certScore: toNumber(r.certScore) ?? 0,
        matchingSkills: r.matchingSkills,
        missingSkills: r.missingSkills,
        eligibility: r.eligibility,
        explanation: r.explanation,
        rank: r.rank,
        roleTitle: r.jobRole.title,
        companyId: r.jobRole.company.id,
        companyName: r.jobRole.company.name,
        dataStatus: r.jobRole.company.dataStatus,
      })),
    });
  })
);

companiesRouter.post(
  '/recommendations/:id/feedback',
  authenticate,
  requireRole('STUDENT'),
  validateBody(recommendationFeedbackSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const recommendationId = String(req.params.id);

    const recRow = await prisma.companyRecommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!recRow) {
      throw new AppError(404, 'RECOMMENDATION_NOT_FOUND', 'Recommendation entry not found.');
    }

    const saved = await prisma.recommendationFeedback.upsert({
      where: {
        recommendationId_studentId: {
          recommendationId,
          studentId,
        },
      },
      create: {
        recommendationId,
        studentId,
        helpful: req.body.helpful,
        comment: req.body.comment ?? null,
      },
      update: {
        helpful: req.body.helpful,
        comment: req.body.comment ?? null,
      },
    });

    return sendSuccess(res, saved, 'Feedback recorded', 201);
  })
);
