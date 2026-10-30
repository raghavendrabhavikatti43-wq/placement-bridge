import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, Prisma, toNumber } from '../../db/prisma.ts';
import {
  getOrCreateStudentByFirebaseUid,
  recalculateAndPersistProfileCompletion,
} from '../../db/users.ts';
import { getCapabilityFlags } from '../config/env.ts';
import { evaluateInterviewAnswerRubric } from '../engines/interviewRubric.ts';
import { analyzeResumeDeterministically } from '../engines/resumeAnalyzer.ts';
import {
  generateAiInterviewFeedback,
  generateAiMockQuestionOrCodeReview,
  generateGroundedPlacementChat,
} from '../integrations/gemini.ts';
import {
  authenticate,
  clearAuthCookies,
  hashOpaqueToken,
  optionalAuthenticate,
  recordDbAudit,
  requireRole,
  setAuthCookies,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { aiRateLimiter, authRateLimiter } from '../middleware/security.ts';
import {
  buildGroundedAiFactsForStudent,
  loadAllSkillsCatalogue,
  loadStudentFrontendApplications,
  loadStudentFrontendSkillGaps,
  loadStudentFullContext,
  loadStudentStudyModules,
  mapCompaniesToFrontendDrives,
} from '../services/studentDataService.ts';
import {
  activeAdminChallenges,
  buildPublicAdminCustodian,
  createSessionAndTokens,
  issueAdminChallenge,
} from './auth.routes.ts';
import { invalidateAdminAnalyticsCache } from './admin.routes.ts';
import { AppError, asyncHandler } from '../utils/errors.ts';
import type { ApplicationStatus } from '../../types.ts';

export const legacyCompatRouter = Router();

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DUMMY_HASH = '$2b$12$KIX9wV2P1v.q.z5S6W1Xee5H2l4rV7x8J1y0mN3bC6vA9sD2fG4hK';

function timingSafeStr(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 1. GET /api/auth/challenge
legacyCompatRouter.get('/auth/challenge', (_req, res) => {
  res.json(issueAdminChallenge());
});

// 2. POST /api/auth/admin/login (PostgreSQL-backed Single Custodian Login)
legacyCompatRouter.post(
  '/auth/admin/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { userId, email, password, challengeId, challengeAnswer } = req.body || {};

    const ch = challengeId ? activeAdminChallenges.get(String(challengeId)) : undefined;
    activeAdminChallenges.delete(String(challengeId || ''));
    if (
      !ch ||
      ch.expiresAt < Date.now() ||
      String(challengeAnswer || '').trim().toUpperCase() !== ch.code
    ) {
      await recordDbAudit({
        action: 'ADMIN_CHALLENGE_FAILED',
        entity: 'AUTH',
        metadata: { actor: String(email || 'unknown'), role: 'admin', outcome: 'BLOCKED' },
        ip: req.ip,
      });
      throw new AppError(
        401,
        'INVALID_CHALLENGE',
        'Invalid or expired security verification code. Please enter the refreshed code.'
      );
    }

    const adminRow = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminRow) {
      await bcrypt.compare(String(password || ''), DUMMY_HASH);
      throw new AppError(401, 'ADMIN_NOT_PROVISIONED', 'Admin custodian account is not provisioned.');
    }

    if (adminRow.lockedUntil && adminRow.lockedUntil.getTime() > Date.now()) {
      const retrySec = Math.ceil((adminRow.lockedUntil.getTime() - Date.now()) / 1000);
      throw new AppError(
        429,
        'ADMIN_LOCKED',
        `Too many failed security attempts. Admin console locked for ${retrySec}s.`
      );
    }

    const cleanId = String(userId || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    const idOk = timingSafeStr(cleanId, adminRow.custodianCode || 'TPO-ADMIN-01');
    const emailOk = timingSafeStr(cleanEmail, adminRow.email);
    const passOk = await bcrypt.compare(cleanPass, adminRow.passwordHash);

    if (!idOk || !emailOk || !passOk) {
      const nextFailed = (adminRow.failedLogins || 0) + 1;
      const lockedUntil = nextFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: adminRow.id },
        data: { failedLogins: nextFailed, lockedUntil, updatedAt: new Date() },
      });

      await recordDbAudit({
        actorId: adminRow.id,
        action: 'Rejected unauthorized Admin credential attempt',
        entity: 'AUTH',
        metadata: {
          actor: `${cleanId || 'N/A'} (${cleanEmail || 'N/A'})`,
          role: 'admin',
          outcome: 'BLOCKED',
        },
        ip: req.ip,
      });

      throw new AppError(
        401,
        'ADMIN_DENIED',
        'Access denied. Admin Portal is restricted to a single authorized custodian (User ID, Email, and Password must all match).'
      );
    }

    await prisma.user.update({
      where: { id: adminRow.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const tokens = await createSessionAndTokens({
      userId: adminRow.id,
      role: 'ADMIN',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    const adminCustodian = buildPublicAdminCustodian(adminRow);
    await recordDbAudit({
      actorId: adminRow.id,
      action: 'Authorized TPO Administrator signed in',
      entity: 'AUTH',
      entityId: adminRow.id,
      metadata: {
        actor: `${adminCustodian.userId} (${adminRow.email})`,
        role: 'admin',
        outcome: 'SUCCESS',
      },
      ip: req.ip,
    });

    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: adminCustodian.userId,
        email: adminRow.email,
        name: adminCustodian.name,
        role: 'admin' as const,
        title: adminCustodian.title,
        avatarUrl: adminCustodian.avatarUrl,
        avatarBg: adminCustodian.avatarBg,
      },
      adminCustodian,
      capabilities: getCapabilityFlags(),
    });
  })
);

// 3. POST /api/auth/student/email (PostgreSQL-backed Student Login & Registration)
legacyCompatRouter.post(
  '/auth/student/email',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { mode = 'signin', email, password, name, department, cgpa } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AppError(400, 'INVALID_EMAIL', 'Please enter a valid student Email ID.');
    }
    if (cleanPass.length < 6) {
      throw new AppError(400, 'SHORT_PASSWORD', 'Password must be at least 6 characters long.');
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existing?.role === 'ADMIN') {
      throw new AppError(
        403,
        'ADMIN_EMAIL_FORBIDDEN',
        'This email belongs to the TPO Administrator. Please use the dedicated Admin Login page.'
      );
    }

    if (mode === 'register') {
      if (existing) {
        throw new AppError(
          409,
          'EMAIL_EXISTS',
          'An account with this Email ID already exists. Switch to Sign In to log in.'
        );
      }

      const derivedName =
        String(name || '').trim() ||
        cleanEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      const parsedCgpa = Math.min(10, Math.max(0, parseFloat(String(cgpa || '8.1')) || 8.1));
      const passwordHash = await bcrypt.hash(cleanPass, 12);

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            uid: `local:${crypto.randomUUID()}`,
            email: cleanEmail,
            passwordHash,
            role: 'STUDENT',
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        const sp = await tx.studentProfile.create({
          data: {
            userId: u.id,
            fullName: derivedName,
            department: String(department || 'Computer Engg (CSE)'),
            cgpa: parsedCgpa.toFixed(2),
            graduationYear: 2027,
            activeBacklogs: 0,
            totalBacklogs: 0,
            completionPct: 35,
          },
        });

        return { u, sp };
      });

      await recalculateAndPersistProfileCompletion(created.sp.id, created.u.id);
      const tokens = await createSessionAndTokens({
        userId: created.u.id,
        role: 'STUDENT',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      await recordDbAudit({
        actorId: created.u.id,
        action: 'Registered & signed in via Student Email ID',
        entity: 'AUTH',
        entityId: created.u.id,
        metadata: { actor: cleanEmail, role: 'student', outcome: 'SUCCESS' },
        ip: req.ip,
      });

      res.json({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: created.u.id,
          email: created.u.email,
          name: created.sp.fullName,
          role: 'student' as const,
          department: created.sp.department || 'Computer Engg (CSE)',
          cgpa: parsedCgpa,
        },
      });
      return;
    }

    // Sign-in mode
    if (existing) {
      if (!existing.isActive) {
        throw new AppError(
          403,
          'ACCOUNT_DEACTIVATED',
          'This student account has been deactivated by the Placement Office.'
        );
      }
      if (existing.lockedUntil && existing.lockedUntil.getTime() > Date.now()) {
        const retrySec = Math.ceil((existing.lockedUntil.getTime() - Date.now()) / 1000);
        throw new AppError(
          429,
          'ACCOUNT_LOCKED',
          `Account temporarily protected after repeated failures. Retry in ${retrySec}s.`
        );
      }

      const ok = await bcrypt.compare(cleanPass, existing.passwordHash);
      if (!ok) {
        const nextFailed = (existing.failedLogins || 0) + 1;
        const lockedUntil = nextFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await prisma.user.update({
          where: { id: existing.id },
          data: { failedLogins: nextFailed, lockedUntil, updatedAt: new Date() },
        });

        await recordDbAudit({
          actorId: existing.id,
          action: 'Invalid student password attempt',
          entity: 'AUTH',
          metadata: { actor: cleanEmail, role: 'student', outcome: 'BLOCKED' },
          ip: req.ip,
        });

        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      await prisma.user.update({
        where: { id: existing.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const sp = await prisma.studentProfile.findUnique({
        where: { userId: existing.id },
      });

      const tokens = await createSessionAndTokens({
        userId: existing.id,
        role: 'STUDENT',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      await recordDbAudit({
        actorId: existing.id,
        action: 'Signed in via Student Email ID',
        entity: 'AUTH',
        entityId: existing.id,
        metadata: { actor: cleanEmail, role: 'student', outcome: 'SUCCESS' },
        ip: req.ip,
      });

      res.json({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: existing.id,
          email: existing.email,
          name: sp?.fullName || existing.email.split('@')[0],
          role: 'student' as const,
          department: sp?.department || 'Computer Engg (CSE)',
          cgpa: toNumber(sp?.cgpa) ?? 8.1,
        },
      });
      return;
    }

    // Open student access: provision new PostgreSQL student account on first email sign-in
    const autoName =
      String(name || '').trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const passwordHash = await bcrypt.hash(cleanPass, 12);

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          uid: `local:${crypto.randomUUID()}`,
          email: cleanEmail,
          passwordHash,
          role: 'STUDENT',
          isActive: true,
          lastLoginAt: new Date(),
        },
      });

      const sp = await tx.studentProfile.create({
        data: {
          userId: u.id,
          fullName: autoName,
          department: 'Computer Engg (CSE)',
          cgpa: '8.10',
          graduationYear: 2027,
          activeBacklogs: 0,
          totalBacklogs: 0,
          completionPct: 35,
        },
      });

      return { u, sp };
    });

    const tokens = await createSessionAndTokens({
      userId: created.u.id,
      role: 'STUDENT',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await recordDbAudit({
      actorId: created.u.id,
      action: 'First-time Student Email ID sign-in provisioned',
      entity: 'AUTH',
      entityId: created.u.id,
      metadata: { actor: cleanEmail, role: 'student', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: created.u.id,
        email: created.u.email,
        name: created.sp.fullName,
        role: 'student' as const,
        department: created.sp.department || 'Computer Engg (CSE)',
        cgpa: 8.1,
      },
    });
  })
);

// 4. POST /api/auth/student/continue (PostgreSQL-backed Federated Sign-In)
legacyCompatRouter.post(
  '/auth/student/continue',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { provider, email, name } = req.body || {};
    const validProviders = ['google', 'institutional-sso', 'github'];
    if (!validProviders.includes(provider)) {
      throw new AppError(400, 'INVALID_PROVIDER', 'Unsupported identity provider.');
    }
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AppError(400, 'INVALID_EMAIL', 'Please provide a valid email address to continue.');
    }

    const adminCheck = await prisma.user.findFirst({
      where: { email: cleanEmail, role: 'ADMIN' },
    });
    if (adminCheck) {
      throw new AppError(
        403,
        'ADMIN_EMAIL_FORBIDDEN',
        'Administrator accounts cannot use Student federated sign-in.'
      );
    }

    const { user, studentProfile } = await getOrCreateStudentByFirebaseUid({
      uid: `federated:${provider}:${cleanEmail}`,
      email: cleanEmail,
      displayName: name,
    });

    const tokens = await createSessionAndTokens({
      userId: user.id,
      role: 'STUDENT',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await recordDbAudit({
      actorId: user.id,
      action: `Authenticated via Continue with ${provider}`,
      entity: 'AUTH',
      entityId: user.id,
      metadata: { actor: cleanEmail, role: 'student', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: studentProfile.fullName,
        role: 'student' as const,
        department: studentProfile.department || 'Computer Engg (CSE)',
        cgpa: toNumber(studentProfile.cgpa) ?? 8.1,
      },
    });
  })
);

// 5. GET /api/auth/me
legacyCompatRouter.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ctx = req.auth!;
    const userRow = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!userRow || !userRow.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired session.');
    }

    if (userRow.role === 'ADMIN') {
      const adminCustodian = buildPublicAdminCustodian(userRow);
      res.json({
        user: {
          id: adminCustodian.userId,
          email: userRow.email,
          name: adminCustodian.name,
          role: 'admin' as const,
          title: adminCustodian.title,
          avatarUrl: adminCustodian.avatarUrl,
          avatarBg: adminCustodian.avatarBg,
        },
        adminCustodian,
        capabilities: getCapabilityFlags(),
      });
      return;
    }

    const stu = await prisma.studentProfile.findUnique({
      where: { userId: userRow.id },
    });

    res.json({
      user: {
        id: userRow.id,
        email: userRow.email,
        name: stu?.fullName || ctx.fullName,
        role: 'student' as const,
        department: stu?.department || 'Computer Engg (CSE)',
        cgpa: toNumber(stu?.cgpa) ?? 8.1,
        avatarUrl: stu?.avatarUrl || '',
        avatarBg: stu?.avatarBg || 'indigo',
      },
      capabilities: getCapabilityFlags(),
    });
  })
);

// 6. POST /api/auth/logout
legacyCompatRouter.post(
  '/auth/logout',
  optionalAuthenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (req.auth?.sessionId) {
      await prisma.userSession.updateMany({
        where: { id: req.auth.sessionId },
        data: { revokedAt: new Date() },
      });
    }
    const rawRefresh = req.cookies?.pb_refresh_token as string | undefined;
    if (rawRefresh) {
      await prisma.userSession.updateMany({
        where: { refreshTokenHash: hashOpaqueToken(rawRefresh) },
        data: { revokedAt: new Date() },
      });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  })
);

// 7. GET /api/student/bootstrap (Full PostgreSQL Student Portal State!)
legacyCompatRouter.get(
  '/student/bootstrap',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const [ctx, drives, apps, modules, gaps] = await Promise.all([
      loadStudentFullContext(studentId),
      mapCompaniesToFrontendDrives(studentId),
      loadStudentFrontendApplications(studentId),
      loadStudentStudyModules(studentId),
      loadStudentFrontendSkillGaps(studentId),
    ]);

    res.json({
      profile: ctx?.frontendProfile || null,
      companies: drives,
      applications: apps,
      studyModules: modules,
      skillGaps: gaps,
      settings: ctx?.portalSettings || null,
      readiness: ctx?.readiness || null,
      completion: ctx?.completion || null,
      capabilities: getCapabilityFlags(),
    });
  })
);

// 8. POST /api/student/applications
legacyCompatRouter.post(
  '/student/applications',
  authenticate,
  requireRole('STUDENT'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.auth!.studentId!;
    const companyIdOrSlug = String(req.body?.companyId || '').trim();
    if (!companyIdOrSlug) {
      throw new AppError(400, 'COMPANY_REQUIRED', 'companyId is required.');
    }

    const isUuid = UUID_REGEX.test(companyIdOrSlug);
    const comp = await prisma.company.findFirst({
      where: isUuid
        ? { OR: [{ id: companyIdOrSlug }, { slug: companyIdOrSlug }] }
        : { slug: companyIdOrSlug },
    });

    if (!comp) throw new AppError(404, 'DRIVE_NOT_FOUND', 'Campus drive not found.');

    const roleRow = await prisma.jobRole.findFirst({
      where: { companyId: comp.id },
    });

    const saved = await prisma.driveApplication.upsert({
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
        round: '1. Online Assessment',
        notes: `Submitted by ${req.auth!.fullName} (${req.auth!.email})`,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    const apps = await loadStudentFrontendApplications(studentId);
    const matched = apps.find((a) => a.id === saved.id) || apps[0];

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: `Applied to ${comp.name} (${roleRow?.title || 'Campus Role'})`,
      entity: 'DRIVE_APPLICATION',
      entityId: saved.id,
      metadata: { actor: req.auth!.email, role: 'student', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    res.json({ application: matched });
  })
);

// 9. GET /api/admin/dashboard (Full PostgreSQL TPO Admin Console State!)
async function buildAdminDashboardPayload(adminUserId: string) {
  const [adminRow, drives, allAppsRows, allStudentsRows, recentAuditRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminUserId } }),
    mapCompaniesToFrontendDrives(undefined),
    prisma.driveApplication.findMany({
      include: {
        company: true,
        jobRole: true,
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    }),
    prisma.studentProfile.findMany({
      include: {
        user: true,
      },
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  const adminCustodian = adminRow ? buildPublicAdminCustodian(adminRow) : null;

  return {
    adminCustodian,
    companies: drives,
    applications: allAppsRows.map((a) => ({
      id: a.id,
      companyId: a.company.slug || a.company.id,
      company: a.company.name,
      role: a.jobRole?.title || 'Software Engineer',
      packageLpa: a.company.packageInfo || 'TBD',
      status: (a.status as ApplicationStatus) || 'Applied',
      date: a.company.driveDate || new Date(a.appliedAt).toLocaleDateString('en-US'),
      round: a.round || '1. Initial Screening',
      notes: a.notes || '',
      studentEmail: a.student.user.email,
      studentName: a.student.fullName,
      studentCgpa: toNumber(a.student.cgpa) ?? 8.0,
    })),
    students: allStudentsRows.map((s) => ({
      id: s.id,
      name: s.fullName,
      email: s.user.email,
      department: s.department || 'Computer Engg (CSE)',
      cgpa: toNumber(s.cgpa) ?? 8.0,
      gradYear: s.graduationYear ?? 2027,
      authMethod: s.user.uid.startsWith('federated:')
        ? s.user.uid.split(':')[1]
        : s.user.uid.startsWith('local:')
        ? 'email'
        : 'google',
      createdAt: s.user.createdAt.toISOString(),
    })),
    auditLogs: recentAuditRows.map((log) => {
      const meta = (log.metadata || {}) as Record<string, unknown>;
      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        actor: String(meta.actor || meta.actorEmail || meta.email || log.actorId || 'SYSTEM'),
        role: (meta.role === 'admin' || meta.role === 'student' ? meta.role : 'admin') as
          | 'admin'
          | 'student'
          | 'unknown',
        event: log.action,
        outcome: (meta.outcome === 'BLOCKED' ? 'BLOCKED' : 'SUCCESS') as 'SUCCESS' | 'BLOCKED',
      };
    }),
  };
}

legacyCompatRouter.get(
  '/admin/dashboard',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const payload = await buildAdminDashboardPayload(req.auth!.userId);
    res.json(payload);
  })
);

// 10. PUT /api/admin/profile
legacyCompatRouter.put(
  '/admin/profile',
  authenticate,
  requireRole('ADMIN'),
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
      action: `Updated Administrator profile & custodian information (${adminCustodian.name})`,
      entity: 'USER',
      entityId: adminRow.id,
      metadata: { actor: updated.email, role: 'admin', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    res.json({
      adminCustodian,
      user: {
        id: adminCustodian.userId,
        email: updated.email,
        name: adminCustodian.name,
        role: 'admin' as const,
        title: adminCustodian.title,
        avatarUrl: adminCustodian.avatarUrl,
        avatarBg: adminCustodian.avatarBg,
      },
    });
  })
);

// 11. POST /api/admin/drives
legacyCompatRouter.post(
  '/admin/drives',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      name,
      role,
      packageLpa,
      location = 'Bengaluru / Hybrid',
      minCgpa = 7.5,
      allowedBacklogs = 0,
      daysRemaining = 14,
      driveDate = 'Nov 28, 2026',
      allowedBranches = ['CSE', 'IT', 'ECE'],
    } = req.body || {};

    if (!name || !role || !packageLpa) {
      throw new AppError(400, 'MISSING_FIELDS', 'Company name, role, and package are required.');
    }

    const cleanName = String(name).trim();
    const slug = `${cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}-${Date.now().toString().slice(-4)}`;

    const createdComp = await prisma.$transaction(async (tx) => {
      const comp = await tx.company.create({
        data: {
          slug,
          name: cleanName,
          logoIcon: 'business_center',
          category: 'TPO Newly Scheduled',
          industry: 'Campus Drive',
          location: String(location).trim(),
          packageInfo: String(packageLpa).trim(),
          driveDate: String(driveDate).trim(),
          daysRemaining: Number(daysRemaining) || 14,
          institutionalNotes: 'Published directly via Restricted TPO Admin Console.',
          dataStatus: 'VERIFIED',
          isActive: true,
        },
      });

      const jr = await tx.jobRole.create({
        data: {
          companyId: comp.id,
          title: String(role).trim(),
          packageInfo: String(packageLpa).trim(),
        },
      });

      await tx.companyRequirement.create({
        data: {
          jobRoleId: jr.id,
          minCgpa: (Number(minCgpa) || 7.5).toFixed(2),
          maxActiveBacklogs: Number(allowedBacklogs) || 0,
          allowedBranches: Array.isArray(allowedBranches) ? allowedBranches : ['CSE', 'IT', 'ECE'],
        },
      });

      await tx.selectionStage.createMany({
        data: [
          { companyId: comp.id, stageOrder: 1, name: 'Online Assessment' },
          { companyId: comp.id, stageOrder: 2, name: 'Technical Interview' },
          { companyId: comp.id, stageOrder: 3, name: 'HR Offer' },
        ],
      });

      return comp;
    });

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: `Published campus drive: ${createdComp.name}`,
      entity: 'COMPANY',
      entityId: createdComp.id,
      metadata: { actor: req.auth!.email, role: 'admin', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    const companiesList = await mapCompaniesToFrontendDrives(undefined);
    const newDrive = companiesList.find((c) => c.id === slug) || companiesList[0];
    res.json({ drive: newDrive, companies: companiesList });
  })
);

// 12. DELETE /api/admin/drives/:id
legacyCompatRouter.delete(
  '/admin/drives/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const idOrSlug = String(req.params.id);
    const isUuid = UUID_REGEX.test(idOrSlug);
    await prisma.company.updateMany({
      where: isUuid
        ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
        : { slug: idOrSlug },
      data: { isActive: false, updatedAt: new Date() },
    });

    invalidateAdminAnalyticsCache();
    await recordDbAudit({
      actorId: req.auth!.userId,
      action: `Removed campus drive: ${idOrSlug}`,
      entity: 'COMPANY',
      entityId: idOrSlug,
      metadata: { actor: req.auth!.email, role: 'admin', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    const companiesList = await mapCompaniesToFrontendDrives(undefined);
    res.json({ companies: companiesList });
  })
);

// 13. PATCH /api/admin/applications/:id
legacyCompatRouter.patch(
  '/admin/applications/:id',
  authenticate,
  requireRole('ADMIN'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id);
    const { status } = req.body || {};
    if (UUID_REGEX.test(targetId)) {
      await prisma.driveApplication.updateMany({
        where: { id: targetId },
        data: { status: String(status || 'Applied'), updatedAt: new Date() },
      });
    }

    await recordDbAudit({
      actorId: req.auth!.userId,
      action: `Updated application ${targetId} status to ${status}`,
      entity: 'DRIVE_APPLICATION',
      entityId: targetId,
      metadata: { actor: req.auth!.email, role: 'admin', outcome: 'SUCCESS' },
      ip: req.ip,
    });

    const dash = await buildAdminDashboardPayload(req.auth!.userId);
    res.json({ applications: dash.applications });
  })
);

// ============================================================================
// LEGACY AI ENDPOINTS BACKED BY GROUNDED DB FACTS & DETERMINISTIC FALLBACKS
// ============================================================================
legacyCompatRouter.post(
  '/ai/chat',
  optionalAuthenticate,
  aiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { message, history = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      throw new AppError(400, 'MESSAGE_REQUIRED', 'Message is required.');
    }

    const studentId = req.auth?.role === 'STUDENT' ? req.auth.studentId : undefined;
    const facts = studentId
      ? await buildGroundedAiFactsForStudent(studentId)
      : {
          factsBlock: '- General Engineering Campus Placement Mode (student profile not signed in).',
          usedFactLabels: ['general'],
          studentFullName: null,
        };

    const mappedHistory = Array.isArray(history)
      ? history
          .slice(-8)
          .map((m: { sender?: string; text?: string }) => ({
            role: (m.sender === 'user' ? 'USER' : 'ASSISTANT') as 'USER' | 'ASSISTANT',
            content: String(m.text || ''),
          }))
      : [];

    const out = await generateGroundedPlacementChat({
      factsBlock: facts.factsBlock,
      usedFactLabels: facts.usedFactLabels,
      history: mappedHistory,
      userMessage: message.slice(0, 2000),
      studentNameToRedact: facts.studentFullName,
    });

    res.json({
      text: out.reply,
      reply: out.reply,
      usedFacts: out.usedFacts,
      priorities: out.priorities,
      recommendedTime: out.recommendedTime,
      aiGenerated: true,
    });
  })
);

legacyCompatRouter.post(
  '/ai/ats-audit',
  optionalAuthenticate,
  aiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { resumeText = '', targetCompany = 'Microsoft', targetRole = 'SDE-1' } = req.body || {};
    const catalogueSkills = await loadAllSkillsCatalogue();
    const syntheticJd = `${targetCompany} ${targetRole} Java Python SQL Data Structures Algorithms System Design REST APIs Git`;
    const deterministic = analyzeResumeDeterministically(
      String(resumeText || 'Engineering student skilled in Java, SQL, DSA, and web systems.'),
      catalogueSkills,
      syntheticJd
    );

    const kwScore = deterministic.keywordMatchPct ?? 72;
    const verbScore = Math.min(98, 55 + deterministic.extracted.actionVerbsFound.length * 8);
    const fmtScore = deterministic.extracted.hasQuantifiedMetrics ? 88 : 74;
    const overallScore = Math.round(0.5 * kwScore + 0.25 * verbScore + 0.25 * fmtScore);

    if (req.auth?.role === 'STUDENT' && req.auth.studentId) {
      await prisma.resumeAnalysis.create({
        data: {
          studentId: req.auth.studentId,
          jobDescription: `${targetCompany} — ${targetRole}`,
          extracted: deterministic.extracted as unknown as Prisma.InputJsonValue,
          keywordMatchPct: kwScore,
          suggestions: deterministic.suggestions as unknown as Prisma.InputJsonValue,
          aiUsed: false,
        },
      });
    }

    res.json({
      overallScore,
      headlineVerdict:
        overallScore >= 80
          ? `Strong Keyword Alignment for ${targetCompany} (${targetRole})`
          : `Moderate Keyword Alignment — Add Missing ${targetRole} Competencies`,
      summaryNote:
        'Deterministic keyword & section match indicator (educational guidance, not a guarantee of recruiter selection).',
      keywordDensity: kwScore,
      actionVerbs: verbScore,
      formatting: fmtScore,
      matchedKeywords: deterministic.matchedKeywords,
      missingKeywords: deterministic.missingKeywords,
      optimizations: deterministic.suggestions.map((s) => ({
        title: s.type,
        detail: s.text,
      })),
    });
  })
);

legacyCompatRouter.post(
  '/ai/mock-interview',
  optionalAuthenticate,
  aiRateLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      action,
      company = 'Microsoft',
      roundType = 'Technical DSA & Core CS',
      question = '',
      answer = '',
      profile,
    } = req.body || {};

    const { aiEnabled } = getCapabilityFlags();

    if (action === 'question') {
      if (aiEnabled) {
        try {
          const out = await generateAiMockQuestionOrCodeReview({
            mode: 'mock-question',
            payload: {
              company,
              roundType,
              department: profile?.department || 'CSE',
              targetRole: profile?.targetRole || 'SDE-1',
            },
          });
          res.json(out);
          return;
        } catch {
          // Fall through to DB bank question
        }
      }

      const dbQs = await prisma.interviewQuestion.findMany({
        where: { isActive: true },
        take: 20,
      });
      const picked = dbQs[Math.floor(Math.random() * Math.max(1, dbQs.length))];
      res.json({
        question:
          picked?.question ||
          `Walk through how you would design an idempotent REST API for ${company} (${roundType}).`,
        interviewerFocus:
          picked?.answerGuidance ||
          'State assumptions, data structures, edge cases, and asymptotic complexity.',
        expectedDuration: '4–5 minutes',
      });
      return;
    }

    // Answer evaluation: deterministic rubric + optional AI enhancement
    const rubric = evaluateInterviewAnswerRubric({
      question: String(question),
      answerGuidance:
        'Cover algorithmic/architectural core principles, concrete trade-offs, complexity, and a clear example.',
      keyPoints: ['complexity', 'trade-off', 'example', 'implementation', 'outcome'],
      answerText: String(answer),
      interviewType: String(roundType).toLowerCase().includes('hr') ? 'HR' : 'TECHNICAL',
    });

    if (aiEnabled && String(answer).trim().length >= 10) {
      try {
        const aiOut = await generateAiInterviewFeedback({
          question: String(question),
          answerGuidance: rubric.refinedSampleAnswer,
          keyPoints: ['Core concept accuracy', 'Structured trade-offs', 'Concrete example'],
          studentAnswer: String(answer),
          studentNameToRedact: req.auth?.fullName,
        });
        const score = Math.round(
          ((aiOut.relevance + aiOut.structure + aiOut.completeness + aiOut.clarity) / 20) * 100
        );
        res.json({
          score,
          verdict: aiOut.summary,
          strengths: aiOut.strengths,
          improvements: aiOut.improvements,
          refinedSampleAnswer: aiOut.refinedSampleAnswer || rubric.refinedSampleAnswer,
          source: 'AI',
        });
        return;
      } catch {
        // Automatic deterministic fallback
      }
    }

    res.json({
      score: rubric.overallScore100,
      verdict: rubric.summary,
      strengths: rubric.strengths,
      improvements: rubric.improvements,
      refinedSampleAnswer: rubric.refinedSampleAnswer,
      source: 'RUBRIC',
    });
  })
);

legacyCompatRouter.post(
  '/ai/code-review',
  optionalAuthenticate,
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const { aiEnabled } = getCapabilityFlags();
    if (aiEnabled) {
      try {
        const review = await generateAiMockQuestionOrCodeReview({
          mode: 'code-review',
          payload: req.body || {},
        });
        res.json(review);
        return;
      } catch {
        // Fallback to static heuristic review below
      }
    }

    const code = String(req.body?.code || '');
    const hasNestedLoops = /for\s*\([\s\S]*?for\s*\(/.test(code);
    res.json({
      passed: code.trim().length > 25,
      timeComplexity: hasNestedLoops ? 'O(N²)' : 'O(N)',
      spaceComplexity: /HashMap|HashSet|dict|unordered_map|new\s+\w+\[/.test(code) ? 'O(N)' : 'O(1)',
      summary:
        'Static heuristic complexity review completed (AI provider unconfigured or offline). Verify boundary inputs manually.',
      edgeCases: [
        'Empty or single-element input collection',
        'Duplicate values and negative integers',
        '32-bit signed integer overflow on cumulative sums',
      ],
    });
  })
);
