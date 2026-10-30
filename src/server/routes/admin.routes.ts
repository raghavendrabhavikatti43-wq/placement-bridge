import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { z } from 'zod';
import { prisma, Prisma, toNumber } from '../../db/prisma.ts';
import { doesBranchMatchAllowed } from '../engines/eligibility.ts';
import { createSignedFileUrl, validateAndStoreFile } from '../integrations/storage.ts';
import {
  authenticate,
  recordDbAudit,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { uploadRateLimiter, validateBody } from '../middleware/security.ts';
import { buildPublicAdminCustodian } from './auth.routes.ts';
import { AppError, asyncHandler } from '../utils/errors.ts';
import {
  buildPaginationMeta,
  escapeCsvCell,
  parsePagination,
  sendSuccess,
} from '../utils/response.ts';

export const adminRouter = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Enforce ADMIN RBAC on EVERY endpoint mounted under /api/v1/admin/*
adminRouter.use(authenticate, requireRole('ADMIN'));

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024, files: 1 },
});

// 5-minute TTL cache for heavy SQL analytics (Part H9)
const analyticsCache = new Map<string, { expiresAt: number; data: unknown }>();
function getCachedAnalytics<T>(key: string): T | null {
  const hit = analyticsCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  return null;
}
function setCachedAnalytics(key: string, data: unknown, ttlMs = 5 * 60 * 1000) {
  analyticsCache.set(key, { expiresAt: Date.now() + ttlMs, data });
}
export function invalidateAdminAnalyticsCache() {
  analyticsCache.clear();
}

// ============================================================================
// ADMIN OVERVIEW & CUSTODIAN PROFILE
// ============================================================================
adminRouter.get(
  '/overview',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const [
      adminRow,
      studentsCount,
      companiesCount,
      rolesCount,
      questionsCount,
      codingCount,
      attemptsCount,
      recentAudits,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.auth!.userId } }),
      prisma.studentProfile.count(),
      prisma.company.count({ where: { isActive: true } }),
      prisma.jobRole.count({ where: { isActive: true } }),
      prisma.question.count({ where: { isActive: true } }),
      prisma.codingProblem.count({ where: { isActive: true } }),
      prisma.quizAttempt.count(),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);

    return sendSuccess(res, {
      adminCustodian: adminRow ? buildPublicAdminCustodian(adminRow) : null,
      counts: {
        students: studentsCount,
        activeCompanies: companiesCount,
        activeJobRoles: rolesCount,
        activeAptitudeQuestions: questionsCount,
        activeCodingProblems: codingCount,
        quizAttempts: attemptsCount,
      },
      recentAuditLogs: recentAudits,
    });
  })
);

adminRouter.put(
  '/profile',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const adminRow = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    });
    if (!adminRow) throw new AppError(404, 'ADMIN_NOT_FOUND', 'Admin user not found.');

    const prevMeta = (adminRow.adminMeta || {}) as Record<string, unknown>;
    const body = req.body || {};

    const nextMeta: Record<string, unknown> = {
      ...prevMeta,
      ...(typeof body.name === 'string' && body.name.trim()
        ? { name: body.name.trim().slice(0, 100) }
        : {}),
      ...(typeof body.title === 'string' && body.title.trim()
        ? { title: body.title.trim().slice(0, 120) }
        : {}),
      ...(typeof body.department === 'string' && body.department.trim()
        ? { department: body.department.trim().slice(0, 140) }
        : {}),
      ...(typeof body.institutionName === 'string' && body.institutionName.trim()
        ? { institutionName: body.institutionName.trim().slice(0, 140) }
        : {}),
      ...(body.batchYear !== undefined ? { batchYear: Number(body.batchYear) || 2027 } : {}),
      ...(typeof body.phone === 'string' ? { phone: body.phone.trim().slice(0, 40) } : {}),
      ...(typeof body.officeLocation === 'string'
        ? { officeLocation: body.officeLocation.trim().slice(0, 140) }
        : {}),
      ...(typeof body.officeHours === 'string'
        ? { officeHours: body.officeHours.trim().slice(0, 120) }
        : {}),
      ...(typeof body.deskEmail === 'string'
        ? { deskEmail: body.deskEmail.trim().slice(0, 120) }
        : {}),
      ...(typeof body.bio === 'string' ? { bio: body.bio.trim().slice(0, 600) } : {}),
      ...(typeof body.avatarUrl === 'string' ? { avatarUrl: body.avatarUrl } : {}),
      ...(typeof body.avatarBg === 'string' && body.avatarBg.trim()
        ? { avatarBg: body.avatarBg.trim() }
        : {}),
    };

    const updated = await prisma.user.update({
      where: { id: adminRow.id },
      data: {
        adminMeta: nextMeta as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    const adminCustodian = buildPublicAdminCustodian(updated);

    await recordDbAudit({
      actorId: adminRow.id,
      action: 'ADMIN_PROFILE_UPDATED',
      entity: 'USER',
      entityId: adminRow.id,
      metadata: { name: adminCustodian.name, outcome: 'SUCCESS' },
      ip: req.ip,
    });

    return sendSuccess(res, {
      adminCustodian,
      user: {
        id: adminCustodian.userId,
        email: updated.email,
        name: adminCustodian.name,
        role: 'admin',
        title: adminCustodian.title,
        avatarUrl: adminCustodian.avatarUrl,
        avatarBg: adminCustodian.avatarBg,
      },
    });
  })
);

// ============================================================================
// ADMIN STUDENT MANAGEMENT
// ============================================================================
adminRouter.get(
  '/students',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 25, 100);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const dept =
      typeof req.query.department === 'string' ? req.query.department.trim().toLowerCase() : '';

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        sp.id AS "studentId",
        u.id AS "userId",
        u.email AS "email",
        u.is_active AS "isActive",
        u.created_at AS "createdAt",
        sp.full_name AS "fullName",
        sp.department AS "department",
        sp.graduation_year AS "graduationYear",
        sp.cgpa AS "cgpa",
        sp.active_backlogs AS "activeBacklogs",
        sp.completion_pct AS "completionPct",
        rs.overall AS "latestReadiness"
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN LATERAL (
        SELECT overall
        FROM readiness_snapshots r
        WHERE r.student_id = sp.id
        ORDER BY r.created_at DESC
        LIMIT 1
      ) rs ON true
      ORDER BY sp.created_at DESC
    `;

    const allStudents = rows.filter((s) => {
      if (dept && !String(s.department || '').toLowerCase().includes(dept)) return false;
      if (q) {
        const hay = `${s.fullName || ''} ${s.email || ''} ${s.department || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const total = allStudents.length;
    const paged = allStudents.slice(offset, offset + pageSize).map((s) => ({
      ...s,
      cgpa: s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa) : null,
      latestReadiness:
        s.latestReadiness !== null && s.latestReadiness !== undefined
          ? Number(s.latestReadiness)
          : null,
    }));

    return sendSuccess(
      res,
      paged,
      'Students retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);

adminRouter.get(
  '/students/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    }
    const stu = await prisma.studentProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
    });
    if (!stu) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

    const userRow = await prisma.user.findUnique({ where: { id: stu.userId } });
    return sendSuccess(res, {
      student: {
        ...stu,
        cgpa: toNumber(stu.cgpa),
        tenthPct: toNumber(stu.tenthPct),
        twelfthPct: toNumber(stu.twelfthPct),
        diplomaPct: toNumber(stu.diplomaPct),
      },
      account: userRow
        ? {
            id: userRow.id,
            email: userRow.email,
            isActive: userRow.isActive,
            lastLoginAt: userRow.lastLoginAt,
            createdAt: userRow.createdAt,
          }
        : null,
    });
  })
);

adminRouter.put(
  '/students/:id/status',
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    }
    const stu = await prisma.studentProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
    });
    if (!stu) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

    await prisma.user.update({
      where: { id: stu.userId },
      data: { isActive: req.body.isActive, updatedAt: new Date() },
    });

    if (!req.body.isActive) {
      await prisma.userSession.updateMany({
        where: { userId: stu.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: req.body.isActive ? 'STUDENT_ACTIVATED' : 'STUDENT_DEACTIVATED',
      entity: 'USER',
      entityId: stu.userId,
      metadata: { studentId: stu.id, isActive: req.body.isActive },
      ip: req.ip,
    });

    return sendSuccess(res, { userId: stu.userId, isActive: req.body.isActive });
  })
);

adminRouter.post(
  '/students/:id/reset-password',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');
    }
    const stu = await prisma.studentProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
    });
    if (!stu) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found.');

    const temporaryPassword = `Tmp#${crypto.randomBytes(6).toString('hex')}!9A`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.user.update({
      where: { id: stu.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });

    await prisma.userSession.updateMany({
      where: { userId: stu.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'STUDENT_PASSWORD_RESET_BY_ADMIN',
      entity: 'USER',
      entityId: stu.userId,
      ip: req.ip,
    });

    return sendSuccess(
      res,
      { userId: stu.userId, temporaryPassword, mustChangePassword: true },
      'Temporary password issued; student must change password on next login'
    );
  })
);

// ============================================================================
// ADMIN COMPANIES, JOB ROLES, REQUIREMENTS, SKILLS & STAGES CRUD
// ============================================================================
const adminCompanySchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  location: z.string().trim().max(140).optional(),
  website: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  packageInfo: z.string().trim().max(120).optional(),
  driveDate: z.string().trim().max(80).optional(),
  daysRemaining: z.coerce.number().int().min(0).max(365).optional(),
  institutionalNotes: z.string().trim().max(1000).optional(),
  dataStatus: z.enum(['SAMPLE', 'VERIFIED']).default('VERIFIED'),
  isActive: z.boolean().default(true),
  // Convenience inline primary role creation
  roleTitle: z.string().trim().max(160).optional(),
  minCgpa: z.coerce.number().min(0).max(10).optional(),
  allowedBranches: z.array(z.string().trim()).optional(),
  maxActiveBacklogs: z.coerce.number().int().min(0).max(20).optional(),
});

adminRouter.get(
  '/companies',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/companies',
  validateBody(adminCompanySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slug =
      req.body.slug ||
      req.body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
        '-' +
        Date.now().toString().slice(-4);

    const created = await prisma.company.create({
      data: {
        name: req.body.name,
        slug,
        industry: req.body.industry ?? 'Technology',
        category: req.body.category ?? 'TPO Verified Recruiter',
        location: req.body.location ?? 'Bengaluru / Hybrid',
        website: req.body.website ?? null,
        description: req.body.description ?? null,
        packageInfo: req.body.packageInfo ?? 'TBD',
        driveDate: req.body.driveDate ?? 'Upcoming',
        daysRemaining: req.body.daysRemaining ?? 14,
        institutionalNotes: req.body.institutionalNotes ?? '',
        dataStatus: req.body.dataStatus,
        isActive: req.body.isActive,
      },
    });

    if (req.body.roleTitle) {
      const role = await prisma.jobRole.create({
        data: {
          companyId: created.id,
          title: req.body.roleTitle,
          packageInfo: req.body.packageInfo ?? 'TBD',
        },
      });

      await prisma.companyRequirement.create({
        data: {
          jobRoleId: role.id,
          minCgpa: req.body.minCgpa !== undefined ? req.body.minCgpa.toFixed(2) : '7.00',
          allowedBranches: req.body.allowedBranches ?? ['CSE', 'IT', 'ECE'],
          maxActiveBacklogs: req.body.maxActiveBacklogs ?? 0,
        },
      });

      await prisma.selectionStage.createMany({
        data: [
          { companyId: created.id, stageOrder: 1, name: 'Online Assessment' },
          { companyId: created.id, stageOrder: 2, name: 'Technical Interview' },
          { companyId: created.id, stageOrder: 3, name: 'HR Offer' },
        ],
      });
    }

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'COMPANY_CREATED',
      entity: 'COMPANY',
      entityId: created.id,
      metadata: { name: created.name, dataStatus: created.dataStatus },
      ip: req.ip,
    });

    return sendSuccess(res, created, 'Company created', 201);
  })
);

adminRouter.put(
  '/companies/:id',
  validateBody(adminCompanySchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const isUuid = UUID_REGEX.test(id);
    const target = await prisma.company.findFirst({
      where: isUuid ? { OR: [{ id }, { slug: id }] } : { slug: id },
    });
    if (!target) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');

    const updated = await prisma.company.update({
      where: { id: target.id },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.industry !== undefined ? { industry: req.body.industry } : {}),
        ...(req.body.category !== undefined ? { category: req.body.category } : {}),
        ...(req.body.location !== undefined ? { location: req.body.location } : {}),
        ...(req.body.website !== undefined ? { website: req.body.website } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.packageInfo !== undefined ? { packageInfo: req.body.packageInfo } : {}),
        ...(req.body.driveDate !== undefined ? { driveDate: req.body.driveDate } : {}),
        ...(req.body.daysRemaining !== undefined ? { daysRemaining: req.body.daysRemaining } : {}),
        ...(req.body.institutionalNotes !== undefined
          ? { institutionalNotes: req.body.institutionalNotes }
          : {}),
        ...(req.body.dataStatus !== undefined ? { dataStatus: req.body.dataStatus } : {}),
        ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
        updatedAt: new Date(),
      },
    });

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'COMPANY_UPDATED',
      entity: 'COMPANY',
      entityId: updated.id,
      ip: req.ip,
    });
    return sendSuccess(res, updated, 'Company updated');
  })
);

adminRouter.delete(
  '/companies/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const isUuid = UUID_REGEX.test(id);
    const target = await prisma.company.findFirst({
      where: isUuid ? { OR: [{ id }, { slug: id }] } : { slug: id },
    });
    if (!target) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');

    const updated = await prisma.company.update({
      where: { id: target.id },
      data: { isActive: false, updatedAt: new Date() },
    });

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'COMPANY_ARCHIVED',
      entity: 'COMPANY',
      entityId: updated.id,
      ip: req.ip,
    });
    return sendSuccess(res, { archived: true, id: updated.id }, 'Company soft-disabled');
  })
);

adminRouter.post(
  '/companies/:id/logo',
  uploadRateLimiter,
  logoUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) throw new AppError(400, 'FILE_REQUIRED', 'Logo image file is required.');
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');

    const asset = await validateAndStoreFile({
      ownerId: req.auth!.userId,
      kind: 'COMPANY_LOGO',
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      declaredMime: req.file.mimetype,
    });
    const signed = createSignedFileUrl(asset.id, 3600);
    await prisma.company.update({
      where: { id },
      data: { logoFileId: asset.id, logoUrl: signed.signedUrl, updatedAt: new Date() },
    });
    return sendSuccess(res, { asset, ...signed }, 'Company logo uploaded', 201);
  })
);

adminRouter.put(
  '/companies/:id/stages',
  validateBody(
    z.object({
      stages: z
        .array(
          z.object({
            stageOrder: z.coerce.number().int().min(1).max(15),
            name: z.string().trim().min(2).max(140),
            description: z.string().trim().max(500).optional(),
          })
        )
        .max(15),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const companyId = String(req.params.id);
    if (!UUID_REGEX.test(companyId)) {
      throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company not found.');
    }
    await prisma.selectionStage.deleteMany({ where: { companyId } });
    if (req.body.stages.length > 0) {
      await prisma.selectionStage.createMany({
        data: req.body.stages.map(
          (s: { stageOrder: number; name: string; description?: string }) => ({
            companyId,
            stageOrder: s.stageOrder,
            name: s.name,
            description: s.description ?? null,
          })
        ),
      });
    }
    const rows = await prisma.selectionStage.findMany({
      where: { companyId },
      orderBy: { stageOrder: 'asc' },
    });
    return sendSuccess(res, rows, 'Selection stages updated');
  })
);

adminRouter.post(
  '/job-roles',
  validateBody(
    z.object({
      companyId: z.string().uuid(),
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(2000).optional(),
      packageInfo: z.string().trim().max(120).optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const created = await prisma.jobRole.create({
      data: {
        companyId: req.body.companyId,
        title: req.body.title,
        description: req.body.description ?? null,
        packageInfo: req.body.packageInfo ?? null,
      },
    });
    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'JOB_ROLE_CREATED',
      entity: 'JOB_ROLE',
      entityId: created.id,
      ip: req.ip,
    });
    return sendSuccess(res, created, 'Job role created', 201);
  })
);

adminRouter.put(
  '/job-roles/:id',
  validateBody(
    z.object({
      title: z.string().trim().min(2).max(160).optional(),
      description: z.string().trim().max(2000).optional(),
      packageInfo: z.string().trim().max(120).optional(),
      isActive: z.boolean().optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');
    const existing = await prisma.jobRole.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');

    const updated = await prisma.jobRole.update({
      where: { id },
      data: req.body,
    });
    invalidateAdminAnalyticsCache();
    return sendSuccess(res, updated, 'Job role updated');
  })
);

adminRouter.delete(
  '/job-roles/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');
    const existing = await prisma.jobRole.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');

    const updated = await prisma.jobRole.update({
      where: { id },
      data: { isActive: false },
    });
    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'JOB_ROLE_ARCHIVED',
      entity: 'JOB_ROLE',
      entityId: updated.id,
      ip: req.ip,
    });
    return sendSuccess(res, { archived: true }, 'Job role archived');
  })
);

adminRouter.put(
  '/job-roles/:id/requirements',
  validateBody(
    z.object({
      minCgpa: z.coerce.number().min(0).max(10).nullable().optional(),
      minTenthPct: z.coerce.number().min(0).max(100).nullable().optional(),
      minTwelfthPct: z.coerce.number().min(0).max(100).nullable().optional(),
      allowedBranches: z.array(z.string().trim()).default([]),
      maxActiveBacklogs: z.coerce.number().int().min(0).max(20).nullable().optional(),
      maxTotalBacklogs: z.coerce.number().int().min(0).max(20).nullable().optional(),
      graduationYear: z.coerce.number().int().min(2020).max(2035).nullable().optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const jobRoleId = String(req.params.id);
    if (!UUID_REGEX.test(jobRoleId)) {
      throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');
    }
    const values = {
      minCgpa:
        req.body.minCgpa !== null && req.body.minCgpa !== undefined
          ? req.body.minCgpa.toFixed(2)
          : null,
      minTenthPct:
        req.body.minTenthPct !== null && req.body.minTenthPct !== undefined
          ? req.body.minTenthPct.toFixed(2)
          : null,
      minTwelfthPct:
        req.body.minTwelfthPct !== null && req.body.minTwelfthPct !== undefined
          ? req.body.minTwelfthPct.toFixed(2)
          : null,
      allowedBranches: req.body.allowedBranches,
      maxActiveBacklogs: req.body.maxActiveBacklogs ?? null,
      maxTotalBacklogs: req.body.maxTotalBacklogs ?? null,
      graduationYear: req.body.graduationYear ?? null,
    };

    const saved = await prisma.companyRequirement.upsert({
      where: { jobRoleId },
      create: { jobRoleId, ...values },
      update: values,
    });

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'ROLE_REQUIREMENTS_UPDATED',
      entity: 'JOB_ROLE',
      entityId: jobRoleId,
      ip: req.ip,
    });
    return sendSuccess(
      res,
      {
        ...saved,
        minCgpa: toNumber(saved.minCgpa),
        minTenthPct: toNumber(saved.minTenthPct),
        minTwelfthPct: toNumber(saved.minTwelfthPct),
      },
      'Role eligibility requirements updated'
    );
  })
);

adminRouter.put(
  '/job-roles/:id/skills',
  validateBody(
    z.object({
      skills: z
        .array(
          z.object({
            skillId: z.string().uuid(),
            importance: z.enum(['MUST', 'GOOD']).default('MUST'),
          })
        )
        .max(40),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const jobRoleId = String(req.params.id);
    if (!UUID_REGEX.test(jobRoleId)) {
      throw new AppError(404, 'JOB_ROLE_NOT_FOUND', 'Job role not found.');
    }
    await prisma.companyRequiredSkill.deleteMany({ where: { jobRoleId } });
    if (req.body.skills.length > 0) {
      await prisma.companyRequiredSkill.createMany({
        data: req.body.skills.map((s: { skillId: string; importance: 'MUST' | 'GOOD' }) => ({
          jobRoleId,
          skillId: s.skillId,
          importance: s.importance,
        })),
      });
    }
    invalidateAdminAnalyticsCache();
    return sendSuccess(
      res,
      { jobRoleId, count: req.body.skills.length },
      'Role required skills updated'
    );
  })
);

adminRouter.patch(
  '/applications/:id',
  validateBody(
    z.object({
      status: z.enum(['Applied', 'OA Scheduled', 'Shortlisted', 'Tech Round', 'Offer']),
      round: z.string().trim().max(140).optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
    }
    const existing = await prisma.driveApplication.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');

    const updated = await prisma.driveApplication.update({
      where: { id },
      data: {
        status: req.body.status,
        ...(req.body.round ? { round: req.body.round } : {}),
        updatedAt: new Date(),
      },
    });
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'APPLICATION_STAGE_UPDATED',
      entity: 'DRIVE_APPLICATION',
      entityId: id,
      metadata: { status: req.body.status },
      ip: req.ip,
    });
    return sendSuccess(res, updated, 'Application status updated');
  })
);

// ============================================================================
// ADMIN CONTENT BANK CRUD (Questions, Quizzes, Coding, Interview, Topics, Resources, Skills)
// ============================================================================
const adminQuestionSchema = z.object({
  category: z.enum([
    'QUANT',
    'LOGICAL',
    'VERBAL',
    'NUMBER_SYSTEMS',
    'PERCENTAGES',
    'PROFIT_LOSS',
    'TIME_WORK',
    'TSD',
    'PROBABILITY',
    'PERM_COMB',
    'CODING_DECODING',
    'SERIES',
    'PUZZLES',
  ]),
  subtopic: z.string().trim().max(120).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  text: z.string().trim().min(5).max(3000),
  explanation: z.string().trim().min(3).max(3000),
  options: z
    .array(
      z.object({
        optionKey: z.string().trim().max(4).optional(),
        text: z.string().trim().min(1).max(1000),
        isCorrect: z.boolean(),
      })
    )
    .length(4)
    .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, {
      message: 'Exactly one option must have isCorrect = true',
    }),
});

adminRouter.get(
  '/questions',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.question.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/questions',
  validateBody(adminQuestionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const keys = ['A', 'B', 'C', 'D'];
    const created = await prisma.question.create({
      data: {
        category: req.body.category,
        subtopic: req.body.subtopic ?? null,
        difficulty: req.body.difficulty,
        text: req.body.text,
        explanation: req.body.explanation,
        createdById: req.auth!.userId,
        options: {
          create: req.body.options.map(
            (o: { optionKey?: string; text: string; isCorrect: boolean }, idx: number) => ({
              optionKey: o.optionKey || keys[idx],
              text: o.text,
              isCorrect: o.isCorrect,
              optionOrder: idx,
            })
          ),
        },
      },
      include: {
        options: { orderBy: { optionOrder: 'asc' } },
      },
    });

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'QUESTION_CREATED',
      entity: 'QUESTION',
      entityId: created.id,
      ip: req.ip,
    });
    return sendSuccess(res, created, 'Question created', 201);
  })
);

adminRouter.put(
  '/questions/:id',
  validateBody(adminQuestionSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found.');

    const updated = await prisma.question.update({
      where: { id },
      data: {
        ...(req.body.category ? { category: req.body.category } : {}),
        ...(req.body.subtopic !== undefined ? { subtopic: req.body.subtopic } : {}),
        ...(req.body.difficulty ? { difficulty: req.body.difficulty } : {}),
        ...(req.body.text ? { text: req.body.text } : {}),
        ...(req.body.explanation ? { explanation: req.body.explanation } : {}),
      },
    });
    return sendSuccess(res, updated, 'Question updated');
  })
);

adminRouter.delete(
  '/questions/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found.');
    await prisma.question.updateMany({
      where: { id },
      data: { isActive: false },
    });
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'QUESTION_DISABLED',
      entity: 'QUESTION',
      entityId: id,
      ip: req.ip,
    });
    return sendSuccess(res, { disabled: true }, 'Question soft-disabled');
  })
);

adminRouter.get(
  '/quizzes',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.quiz.findMany();
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/quizzes',
  validateBody(
    z.object({
      title: z.string().trim().min(2).max(160),
      category: z
        .enum([
          'QUANT',
          'LOGICAL',
          'VERBAL',
          'NUMBER_SYSTEMS',
          'PERCENTAGES',
          'PROFIT_LOSS',
          'TIME_WORK',
          'TSD',
          'PROBABILITY',
          'PERM_COMB',
          'CODING_DECODING',
          'SERIES',
          'PUZZLES',
        ])
        .optional(),
      numQuestions: z.coerce.number().int().min(1).max(50).default(10),
      timeLimitSec: z.coerce.number().int().min(60).max(7200).default(600),
      questionIds: z.array(z.string().uuid()).optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const created = await prisma.quiz.create({
      data: {
        title: req.body.title,
        category: req.body.category ?? null,
        numQuestions: req.body.numQuestions,
        timeLimitSec: req.body.timeLimitSec,
      },
    });

    if (Array.isArray(req.body.questionIds) && req.body.questionIds.length > 0) {
      await prisma.quizQuestion.createMany({
        data: req.body.questionIds.map((qId: string, idx: number) => ({
          quizId: created.id,
          questionId: qId,
          position: idx + 1,
        })),
        skipDuplicates: true,
      });
    }
    return sendSuccess(res, created, 'Quiz created', 201);
  })
);

adminRouter.delete(
  '/quizzes/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (UUID_REGEX.test(id)) {
      await prisma.quiz.updateMany({
        where: { id },
        data: { isActive: false },
      });
    }
    return sendSuccess(res, { disabled: true }, 'Quiz soft-disabled');
  })
);

// Coding Problems & Admin Test Case CRUD
adminRouter.get(
  '/coding/problems',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.codingProblem.findMany({ orderBy: { title: 'asc' } });
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/coding/problems',
  validateBody(
    z.object({
      title: z.string().trim().min(2).max(160),
      slug: z.string().trim().max(120).optional(),
      description: z.string().trim().min(10).max(6000),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
      topic: z.string().trim().min(2).max(80),
      inputFormat: z.string().trim().min(1).max(1000),
      outputFormat: z.string().trim().min(1).max(1000),
      sampleInput: z.string().min(1).max(2000),
      sampleOutput: z.string().min(1).max(2000),
      constraints: z.string().trim().min(1).max(1000),
      hint: z.string().trim().max(1000).optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slug =
      req.body.slug ||
      req.body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const created = await prisma.codingProblem.create({
      data: {
        ...req.body,
        slug,
        hint: req.body.hint ?? null,
      },
    });

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'CODING_PROBLEM_CREATED',
      entity: 'CODING_PROBLEM',
      entityId: created.id,
      ip: req.ip,
    });
    return sendSuccess(res, created, 'Coding problem created', 201);
  })
);

adminRouter.put(
  '/coding/problems/:id',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) throw new AppError(404, 'PROBLEM_NOT_FOUND', 'Problem not found.');
    const existing = await prisma.codingProblem.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, 'PROBLEM_NOT_FOUND', 'Problem not found.');

    const updated = await prisma.codingProblem.update({
      where: { id },
      data: req.body || {},
    });
    return sendSuccess(res, updated, 'Coding problem updated');
  })
);

adminRouter.delete(
  '/coding/problems/:id',
  asyncHandler(async (_req, res) => {
    const id = String(_req.params.id);
    if (UUID_REGEX.test(id)) {
      await prisma.codingProblem.updateMany({
        where: { id },
        data: { isActive: false },
      });
    }
    return sendSuccess(res, { disabled: true }, 'Coding problem soft-disabled');
  })
);

adminRouter.get(
  '/coding/problems/:id/test-cases',
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) return sendSuccess(res, []);
    const rows = await prisma.codingTestCase.findMany({
      where: { problemId: id },
    });
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/coding/problems/:id/test-cases',
  validateBody(
    z.object({
      input: z.string().min(1).max(5000),
      expectedOutput: z.string().min(1).max(5000),
      isHidden: z.boolean().default(true),
    })
  ),
  asyncHandler(async (req, res) => {
    const problemId = String(req.params.id);
    if (!UUID_REGEX.test(problemId)) {
      throw new AppError(404, 'PROBLEM_NOT_FOUND', 'Coding problem not found.');
    }
    const created = await prisma.codingTestCase.create({
      data: {
        problemId,
        input: req.body.input,
        expectedOutput: req.body.expectedOutput,
        isHidden: req.body.isHidden,
      },
    });
    return sendSuccess(res, created, 'Test case added', 201);
  })
);

// Interview Questions, Topics, Resources, Skills CRUD
adminRouter.post(
  '/interview/questions',
  validateBody(
    z.object({
      type: z.enum(['TECHNICAL', 'HR', 'PROJECT', 'COMPANY']),
      category: z.string().trim().min(2).max(120),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
      question: z.string().trim().min(5).max(2000),
      answerGuidance: z.string().trim().min(5).max(3000),
      keyPoints: z.array(z.string().trim()).default([]),
      companyId: z.string().uuid().optional(),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const created = await prisma.interviewQuestion.create({
      data: {
        ...req.body,
        companyId: req.body.companyId ?? null,
      },
    });
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'INTERVIEW_QUESTION_CREATED',
      entity: 'INTERVIEW_QUESTION',
      entityId: created.id,
      ip: req.ip,
    });
    return sendSuccess(res, created, 'Interview question created', 201);
  })
);

adminRouter.delete(
  '/interview/questions/:id',
  asyncHandler(async (_req, res) => {
    const id = String(_req.params.id);
    if (UUID_REGEX.test(id)) {
      await prisma.interviewQuestion.updateMany({
        where: { id },
        data: { isActive: false },
      });
    }
    return sendSuccess(res, { disabled: true });
  })
);

adminRouter.post(
  '/topics',
  validateBody(
    z.object({
      category: z.string().trim().min(2).max(100),
      title: z.string().trim().min(2).max(160),
      description: z.string().trim().max(1500).optional(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
      estimatedHours: z.coerce.number().min(0.5).max(100).default(2.0),
      sequenceOrder: z.coerce.number().int().min(1).max(500),
      prerequisiteId: z.string().uuid().nullable().optional(),
      week: z.coerce.number().int().min(1).max(12).default(1),
    })
  ),
  asyncHandler(async (req, res) => {
    const created = await prisma.preparationTopic.create({
      data: {
        category: req.body.category,
        title: req.body.title,
        description: req.body.description ?? null,
        difficulty: req.body.difficulty,
        estimatedHours: req.body.estimatedHours.toFixed(1),
        sequenceOrder: req.body.sequenceOrder,
        prerequisiteId: req.body.prerequisiteId ?? null,
        week: req.body.week,
      },
    });
    return sendSuccess(
      res,
      { ...created, estimatedHours: toNumber(created.estimatedHours) ?? 2 },
      'Preparation topic created',
      201
    );
  })
);

adminRouter.post(
  '/resources',
  validateBody(
    z.object({
      title: z.string().trim().min(2).max(180),
      url: z.string().trim().min(5).max(500),
      type: z.enum(['VIDEO', 'ARTICLE', 'COURSE', 'PRACTICE']),
      skillId: z.string().uuid().nullable().optional(),
      topicId: z.string().uuid().nullable().optional(),
      summary: z.string().trim().max(1000).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const created = await prisma.learningResource.create({
      data: {
        title: req.body.title,
        url: req.body.url,
        type: req.body.type,
        skillId: req.body.skillId ?? null,
        topicId: req.body.topicId ?? null,
        summary: req.body.summary ?? null,
      },
    });
    return sendSuccess(res, created, 'Learning resource created', 201);
  })
);

adminRouter.post(
  '/skills',
  validateBody(
    z.object({
      name: z.string().trim().min(1).max(80),
      category: z.enum(['LANGUAGE', 'FRAMEWORK', 'DATABASE', 'TOOL', 'TECHNICAL', 'SOFT']),
      aliases: z.array(z.string().trim()).default([]),
    })
  ),
  asyncHandler(async (req, res) => {
    const existing = await prisma.skill.findFirst({
      where: { name: { equals: req.body.name, mode: 'insensitive' } },
    });
    if (existing) throw new AppError(409, 'SKILL_EXISTS', 'Skill already exists in catalogue.');
    const created = await prisma.skill.create({ data: req.body });
    return sendSuccess(res, created, 'Skill created', 201);
  })
);

// ============================================================================
// ADMIN ANNOUNCEMENTS & TRANSACTIONAL PUBLISH
// ============================================================================
const announcementSchema = z.object({
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(5).max(4000),
  audience: z
    .object({
      departments: z.array(z.string().trim()).optional(),
      graduationYears: z.array(z.coerce.number().int()).optional(),
    })
    .default({}),
});

adminRouter.get(
  '/announcements',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
    return sendSuccess(res, rows);
  })
);

adminRouter.post(
  '/announcements',
  validateBody(announcementSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const created = await prisma.announcement.create({
      data: {
        title: req.body.title,
        body: req.body.body,
        status: 'DRAFT',
        audience: req.body.audience as Prisma.InputJsonValue,
        createdById: req.auth!.userId,
      },
    });
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'ANNOUNCEMENT_CREATED',
      entity: 'ANNOUNCEMENT',
      entityId: created.id,
      ip: req.ip,
    });
    return sendSuccess(res, created, 'Announcement draft created', 201);
  })
);

adminRouter.post(
  '/announcements/:id/publish',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.');
    }
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Announcement not found.');

    const allStudents = await prisma.studentProfile.findMany();
    const aud = (ann.audience || {}) as {
      departments?: string[];
      graduationYears?: number[];
    };

    const matchingStudents = allStudents.filter((stu) => {
      if (Array.isArray(aud.departments) && aud.departments.length > 0) {
        const bm = doesBranchMatchAllowed(stu.department, aud.departments);
        if (!bm.matched) return false;
      }
      if (
        Array.isArray(aud.graduationYears) &&
        aud.graduationYears.length > 0 &&
        stu.graduationYear
      ) {
        if (!aud.graduationYears.includes(stu.graduationYear)) return false;
      }
      return true;
    });

    await prisma.$transaction(async (tx) => {
      await tx.announcement.update({
        where: { id },
        data: { status: 'PUBLISHED', publishAt: new Date() },
      });

      if (matchingStudents.length > 0) {
        await tx.announcementRecipient.createMany({
          data: matchingStudents.map((stu) => ({
            announcementId: id,
            studentId: stu.id,
          })),
          skipDuplicates: true,
        });

        await tx.notification.createMany({
          data: matchingStudents.map((stu) => ({
            userId: stu.userId,
            type: 'ANNOUNCEMENT' as const,
            title: ann.title,
            body: ann.body,
          })),
        });
      }
    });

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: 'ANNOUNCEMENT_PUBLISHED',
      entity: 'ANNOUNCEMENT',
      entityId: id,
      metadata: { recipientsCount: matchingStudents.length },
      ip: req.ip,
    });

    return sendSuccess(
      res,
      { id, status: 'PUBLISHED', recipientsCount: matchingStudents.length },
      'Announcement published and notifications dispatched'
    );
  })
);

// ============================================================================
// ADMIN ANALYTICS (Part F17 & Part H9 — SQL GROUP BY / COUNT / DISTINCT ON + 5m Cache)
// ============================================================================
adminRouter.get(
  '/analytics/eligibility',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('eligibility');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        c.name AS "companyName",
        jr.id AS "jobRoleId",
        jr.title AS "roleTitle",
        c.data_status AS "dataStatus",
        COUNT(*) FILTER (WHERE ec.status = 'ELIGIBLE')::int AS "eligibleCount",
        COUNT(*) FILTER (WHERE ec.status = 'NOT_ELIGIBLE')::int AS "notEligibleCount",
        COUNT(*) FILTER (WHERE ec.status = 'INSUFFICIENT_INFO')::int AS "insufficientInfoCount"
      FROM job_roles jr
      INNER JOIN companies c ON c.id = jr.company_id
      LEFT JOIN (
        SELECT DISTINCT ON (student_id, job_role_id)
          student_id, job_role_id, status
        FROM eligibility_checks
        ORDER BY student_id, job_role_id, checked_at DESC
      ) ec ON ec.job_role_id = jr.id
      WHERE jr.is_active = true AND c.is_active = true
      GROUP BY c.name, jr.id, jr.title, c.data_status
      ORDER BY "eligibleCount" DESC, c.name ASC
    `;

    setCachedAnalytics('eligibility', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/readiness-distribution',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('readiness-distribution');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      WITH latest AS (
        SELECT DISTINCT ON (student_id)
          student_id,
          overall::numeric AS overall
        FROM readiness_snapshots
        ORDER BY student_id, created_at DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE overall >= 0 AND overall < 20)::int AS "bucket_0_20",
        COUNT(*) FILTER (WHERE overall >= 20 AND overall < 40)::int AS "bucket_20_40",
        COUNT(*) FILTER (WHERE overall >= 40 AND overall < 60)::int AS "bucket_40_60",
        COUNT(*) FILTER (WHERE overall >= 60 AND overall < 80)::int AS "bucket_60_80",
        COUNT(*) FILTER (WHERE overall >= 80 AND overall <= 100)::int AS "bucket_80_100",
        ROUND(COALESCE(AVG(overall), 0), 2)::float AS "averageReadiness"
      FROM latest
    `;

    const data = rows[0] || {
      bucket_0_20: 0,
      bucket_20_40: 0,
      bucket_40_60: 0,
      bucket_60_80: 0,
      bucket_80_100: 0,
      averageReadiness: 0,
    };
    setCachedAnalytics('readiness-distribution', data);
    return sendSuccess(res, data);
  })
);

adminRouter.get(
  '/analytics/quiz-performance',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('quiz-performance');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        COALESCE(category::text, 'MIXED') AS "category",
        COUNT(*)::int AS "attemptsCount",
        ROUND(AVG((score::numeric / NULLIF(total, 0)) * 100), 2)::float AS "averageScorePct"
      FROM quiz_attempts
      WHERE status IN ('SUBMITTED', 'EXPIRED') AND score IS NOT NULL
      GROUP BY category
      ORDER BY "attemptsCount" DESC
    `;

    setCachedAnalytics('quiz-performance', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/coding-performance',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('coding-performance');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        cp.difficulty AS "difficulty",
        cp.topic AS "topic",
        COUNT(cs.id)::int AS "submissionsCount",
        COUNT(cs.id) FILTER (WHERE cs.status IN ('PASSED', 'SELF_MARKED_SOLVED'))::int AS "solvedCount"
      FROM coding_problems cp
      LEFT JOIN coding_submissions cs ON cs.problem_id = cp.id
      WHERE cp.is_active = true
      GROUP BY cp.difficulty, cp.topic
      ORDER BY "solvedCount" DESC, cp.topic ASC
    `;

    setCachedAnalytics('coding-performance', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/skill-gaps',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('skill-gaps');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        s.id AS "skillId",
        s.name AS "skillName",
        s.category AS "category",
        COUNT(sgi.id) FILTER (WHERE sgi.status = 'MISSING')::int AS "missingCount",
        COUNT(sgi.id) FILTER (WHERE sgi.status = 'PARTIAL')::int AS "partialCount"
      FROM skill_gap_items sgi
      INNER JOIN skills s ON s.id = sgi.skill_id
      WHERE sgi.status IN ('MISSING', 'PARTIAL')
      GROUP BY s.id, s.name, s.category
      ORDER BY "missingCount" DESC, "partialCount" DESC
      LIMIT 15
    `;

    setCachedAnalytics('skill-gaps', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/departments',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('departments');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        COALESCE(sp.department, 'Unspecified') AS "department",
        COUNT(sp.id)::int AS "studentCount",
        ROUND(AVG(sp.cgpa::numeric), 2)::float AS "avgCgpa",
        ROUND(AVG(sp.completion_pct::numeric), 1)::float AS "avgCompletionPct",
        ROUND(AVG(rs.overall::numeric), 2)::float AS "avgReadiness"
      FROM student_profiles sp
      LEFT JOIN LATERAL (
        SELECT overall
        FROM readiness_snapshots r
        WHERE r.student_id = sp.id
        ORDER BY r.created_at DESC
        LIMIT 1
      ) rs ON true
      GROUP BY sp.department
      ORDER BY "studentCount" DESC
    `;

    setCachedAnalytics('departments', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/preparation',
  asyncHandler(async (_req, res) => {
    const cached = getCachedAnalytics('preparation');
    if (cached) return sendSuccess(res, cached);

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        pt.category AS "category",
        COUNT(DISTINCT pt.id)::int AS "topicsCount",
        COUNT(sp.id) FILTER (WHERE sp.status = 'COMPLETED')::int AS "completedEntries",
        COUNT(sp.id) FILTER (WHERE sp.status = 'IN_PROGRESS')::int AS "inProgressEntries"
      FROM preparation_topics pt
      LEFT JOIN student_progress sp ON sp.topic_id = pt.id
      WHERE pt.is_active = true
      GROUP BY pt.category
      ORDER BY pt.category ASC
    `;

    setCachedAnalytics('preparation', rows);
    return sendSuccess(res, rows);
  })
);

adminRouter.get(
  '/analytics/registrations',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        date_trunc('day', created_at) AS "day",
        COUNT(*)::int AS "registrations"
      FROM users
      WHERE role = 'STUDENT'
      GROUP BY "day"
      ORDER BY "day" ASC
    `;
    return sendSuccess(res, rows);
  })
);

// ============================================================================
// ADMIN FORMULA-INJECTION-SAFE CSV EXPORTS & AUDIT LOGS
// ============================================================================
adminRouter.get(
  '/reports/students.csv',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        sp.full_name AS "fullName",
        u.email AS "email",
        sp.department AS "department",
        sp.graduation_year AS "graduationYear",
        sp.cgpa::float AS "cgpa",
        sp.active_backlogs AS "activeBacklogs",
        sp.completion_pct AS "completionPct",
        u.is_active AS "isActive"
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      ORDER BY sp.full_name ASC
    `;

    const header = [
      'Full Name',
      'Email',
      'Department',
      'Graduation Year',
      'CGPA',
      'Active Backlogs',
      'Profile Completion %',
      'Active Status',
    ].join(',');

    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.fullName),
        escapeCsvCell(r.email),
        escapeCsvCell(r.department),
        escapeCsvCell(r.graduationYear),
        escapeCsvCell(r.cgpa),
        escapeCsvCell(r.activeBacklogs),
        escapeCsvCell(r.completionPct),
        escapeCsvCell(r.isActive ? 'ACTIVE' : 'DEACTIVATED'),
      ].join(',')
    );

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="placement_bridge_students.csv"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(csv);
  })
);

adminRouter.get(
  '/reports/analytics.csv',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        COALESCE(sp.department, 'Unspecified') AS "department",
        COUNT(sp.id)::int AS "studentCount",
        ROUND(AVG(sp.cgpa::numeric), 2)::float AS "avgCgpa",
        ROUND(AVG(sp.completion_pct::numeric), 1)::float AS "avgCompletionPct"
      FROM student_profiles sp
      GROUP BY sp.department
      ORDER BY "studentCount" DESC
    `;

    const header = ['Department', 'Students Count', 'Average CGPA', 'Average Completion %'].join(',');
    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.department),
        escapeCsvCell(r.studentCount),
        escapeCsvCell(r.avgCgpa),
        escapeCsvCell(r.avgCompletionPct),
      ].join(',')
    );

    const csv = [header, ...lines].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="placement_bridge_analytics.csv"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(csv);
  })
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePagination(req.query as Record<string, unknown>, 30, 100);
    const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } });
    const total = rows.length;
    const paged = rows.slice(offset, offset + pageSize);
    return sendSuccess(
      res,
      paged,
      'Audit logs retrieved',
      200,
      buildPaginationMeta(page, pageSize, total)
    );
  })
);
