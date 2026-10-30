import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { StudentProfile, User } from '@prisma/client';
import { prisma, toNumber } from '../../db/prisma.ts';
import {
  getOrCreateStudentByFirebaseUid,
  recalculateAndPersistProfileCompletion,
} from '../../db/users.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { getCapabilityFlags } from '../config/env.ts';
import { sendTransactionalEmail } from '../integrations/email.ts';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  authenticate,
  clearAuthCookies,
  hashOpaqueToken,
  recordDbAudit,
  setAuthCookies,
  signAccessJwt,
  type AuthenticatedRequest,
} from '../middleware/auth.ts';
import { authRateLimiter, validateBody } from '../middleware/security.ts';
import { AppError, asyncHandler, sanitizeDbError } from '../utils/errors.ts';
import { sendSuccess } from '../utils/response.ts';

export const authRouter = Router();

// Precomputed bcrypt cost-12 hash of a random dummy string to equalize timing when email does not exist
const DUMMY_BCRYPT_HASH = '$2b$12$KIX9wV2P1v.q.z5S6W1Xee5H2l4rV7x8J1y0mN3bC6vA9sD2fG4hK';

interface ChallengeEntry {
  code: string;
  expiresAt: number;
}
export const activeAdminChallenges = new Map<string, ChallengeEntry>();

export function issueAdminChallenge() {
  const now = Date.now();
  for (const [k, v] of activeAdminChallenges.entries()) {
    if (v.expiresAt < now) activeAdminChallenges.delete(k);
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  const challengeId = crypto.randomUUID();
  activeAdminChallenges.set(challengeId, {
    code,
    expiresAt: now + 5 * 60 * 1000,
  });
  return { challengeId, code };
}

function timingSafeStringMatch(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const registerBodySchema = z.object({
  email: z.string().trim().email().max(180),
  password: strongPasswordSchema,
  fullName: z.string().trim().min(2).max(120).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  department: z.string().trim().max(120).optional(),
  graduationYear: z.coerce.number().int().min(2020).max(2035).optional(),
  cgpa: z.coerce.number().min(0).max(10).optional(),
});

const loginBodySchema = z.object({
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128),
});

const adminLoginBodySchema = z.object({
  userId: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(128),
  challengeId: z.string().trim().min(1),
  challengeAnswer: z.string().trim().min(4).max(12),
});

const googleOAuthBodySchema = z.object({
  idToken: z.string().min(20),
});

const continueWithBodySchema = z.object({
  provider: z.enum(['google', 'institutional-sso', 'github']),
  email: z.string().trim().email().max(180),
  name: z.string().trim().max(120).optional(),
});

const forgotPasswordBodySchema = z.object({
  email: z.string().trim().email().max(180),
});

const resetPasswordBodySchema = z.object({
  token: z.string().trim().min(16).max(256),
  newPassword: strongPasswordSchema,
});

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: strongPasswordSchema,
});

export async function createSessionAndTokens(params: {
  userId: string;
  role: 'STUDENT' | 'ADMIN';
  userAgent?: string;
  ip?: string;
}) {
  const rawRefresh = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = hashOpaqueToken(rawRefresh);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const sessionRow = await prisma.userSession.create({
    data: {
      userId: params.userId,
      refreshTokenHash,
      userAgent: params.userAgent?.slice(0, 255) || null,
      ip: params.ip || null,
      expiresAt,
    },
  });

  const accessToken = signAccessJwt({
    sub: params.userId,
    role: params.role,
    sessionId: sessionRow.id,
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    sessionId: sessionRow.id,
    expiresAt,
  };
}

export function buildPublicAdminCustodian(userRow: User) {
  const meta = (userRow.adminMeta || {}) as Record<string, unknown>;
  return {
    userId: userRow.custodianCode || 'TPO-ADMIN-01',
    email: userRow.email,
    name: String(meta.name || 'Dr. Rajesh Verma'),
    title: String(meta.title || 'Chief Training & Placement Officer'),
    department: String(meta.department || 'Department of Computer Science & Placement Cell'),
    institutionName: String(meta.institutionName || 'National Institute of Engineering'),
    batchYear: Number(meta.batchYear || 2025),
    phone: String(meta.phone || '+91 821 248 0475'),
    officeLocation: String(meta.officeLocation || 'Administrative Block, Wing B — Room 204'),
    officeHours: String(meta.officeHours || 'Mon – Fri · 10:00 AM to 4:30 PM IST'),
    deskEmail: String(meta.deskEmail || 'tpo.office@nie-placement.edu'),
    bio: String(
      meta.bio ||
        'Overseeing institutional recruiter partnerships, Day-0/Day-1 campus hiring governance, and academic eligibility compliance across all engineering branches.'
    ),
    avatarUrl: String(meta.avatarUrl || ''),
    avatarBg: String(meta.avatarBg || 'indigo'),
  };
}

// 1. GET /api/v1/auth/challenge
authRouter.get('/challenge', (_req, res) => {
  const challenge = issueAdminChallenge();
  return sendSuccess(res, challenge, 'Security challenge issued');
});

// 2. POST /api/v1/auth/register (Student self-registration ONLY)
authRouter.post(
  '/register',
  authRateLimiter,
  validateBody(registerBodySchema),
  asyncHandler(async (req, res) => {
    const cleanEmail = req.body.email.trim().toLowerCase();
    const displayName =
      (req.body.fullName || req.body.name || '').trim() ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

    try {
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
      }

      const passwordHash = await bcrypt.hash(req.body.password, 12);
      const localUid = `local:${crypto.randomUUID()}`;

      const created = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            uid: localUid,
            email: cleanEmail,
            passwordHash,
            role: 'STUDENT',
            isActive: true,
            mustChangePassword: false,
            lastLoginAt: new Date(),
          },
        });

        const newProfile = await tx.studentProfile.create({
          data: {
            userId: newUser.id,
            fullName: displayName,
            department: req.body.department || 'Computer Engg (CSE)',
            graduationYear: req.body.graduationYear ?? 2025,
            cgpa: req.body.cgpa !== undefined ? Number(req.body.cgpa).toFixed(2) : null,
            activeBacklogs: 0,
            totalBacklogs: 0,
            completionPct: 25,
          },
        });

        return { newUser, newProfile };
      });

      const completion = await recalculateAndPersistProfileCompletion(
        created.newProfile.id,
        created.newUser.id
      );

      const tokens = await createSessionAndTokens({
        userId: created.newUser.id,
        role: 'STUDENT',
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      await recordDbAudit({
        actorId: created.newUser.id,
        action: 'STUDENT_REGISTERED',
        entity: 'USER',
        entityId: created.newUser.id,
        metadata: { email: cleanEmail },
        ip: req.ip,
      });

      return sendSuccess(
        res,
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: created.newUser.id,
            studentId: created.newProfile.id,
            email: created.newUser.email,
            name: created.newProfile.fullName,
            fullName: created.newProfile.fullName,
            role: 'STUDENT',
            department: created.newProfile.department,
            cgpa: toNumber(created.newProfile.cgpa),
            completionPct: completion.pct,
            mustChangePassword: false,
          },
          capabilities: getCapabilityFlags(),
        },
        'Student account registered',
        201
      );
    } catch (err) {
      sanitizeDbError('auth.register', err);
    }
  })
);

// 3. POST /api/v1/auth/login (Email + Password with DB lockout & uniform error)
authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginBodySchema),
  asyncHandler(async (req, res) => {
    const cleanEmail = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    try {
      const userRow = await prisma.user.findUnique({ where: { email: cleanEmail } });

      if (!userRow) {
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }

      if (!userRow.isActive) {
        throw new AppError(
          403,
          'ACCOUNT_DEACTIVATED',
          'This account has been deactivated by the Placement Office.'
        );
      }

      if (userRow.lockedUntil && userRow.lockedUntil.getTime() > Date.now()) {
        const retrySec = Math.ceil((userRow.lockedUntil.getTime() - Date.now()) / 1000);
        throw new AppError(
          423,
          'ACCOUNT_LOCKED',
          `Account temporarily locked after repeated failed attempts. Try again in ${retrySec}s.`
        );
      }

      const validPassword = await bcrypt.compare(password, userRow.passwordHash);
      if (!validPassword) {
        const nextFailed = (userRow.failedLogins || 0) + 1;
        const lockedUntil = nextFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

        await prisma.user.update({
          where: { id: userRow.id },
          data: {
            failedLogins: nextFailed,
            lockedUntil,
            updatedAt: new Date(),
          },
        });

        await recordDbAudit({
          actorId: userRow.id,
          action: lockedUntil ? 'LOGIN_LOCKOUT_TRIGGERED' : 'LOGIN_FAILED',
          entity: 'USER',
          entityId: userRow.id,
          metadata: { email: cleanEmail, failedLogins: nextFailed, outcome: 'BLOCKED' },
          ip: req.ip,
        });

        if (lockedUntil) {
          throw new AppError(
            423,
            'ACCOUNT_LOCKED',
            'Account temporarily locked for 15 minutes after 5 failed attempts.'
          );
        }
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      }

      await prisma.user.update({
        where: { id: userRow.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const tokens = await createSessionAndTokens({
        userId: userRow.id,
        role: userRow.role,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      let profileData: StudentProfile | null = null;
      if (userRow.role === 'STUDENT') {
        profileData = await prisma.studentProfile.findUnique({
          where: { userId: userRow.id },
        });
      }

      await recordDbAudit({
        actorId: userRow.id,
        action: 'USER_LOGGED_IN',
        entity: 'USER',
        entityId: userRow.id,
        metadata: { email: cleanEmail, role: userRow.role, outcome: 'SUCCESS' },
        ip: req.ip,
      });

      const adminCustodian =
        userRow.role === 'ADMIN' ? buildPublicAdminCustodian(userRow) : undefined;

      return sendSuccess(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: userRow.role === 'ADMIN' ? adminCustodian!.userId : userRow.id,
          userId: userRow.id,
          studentId: profileData?.id ?? null,
          email: userRow.email,
          name:
            userRow.role === 'ADMIN'
              ? adminCustodian!.name
              : profileData?.fullName || userRow.email.split('@')[0],
          fullName:
            userRow.role === 'ADMIN'
              ? adminCustodian!.name
              : profileData?.fullName || userRow.email.split('@')[0],
          role: userRow.role,
          department: profileData?.department ?? adminCustodian?.department,
          cgpa: profileData && profileData.cgpa !== null ? toNumber(profileData.cgpa) ?? undefined : undefined,
          avatarUrl: profileData?.avatarUrl ?? adminCustodian?.avatarUrl ?? '',
          avatarBg: profileData?.avatarBg ?? adminCustodian?.avatarBg ?? 'indigo',
          mustChangePassword: userRow.mustChangePassword,
        },
        ...(adminCustodian ? { adminCustodian } : {}),
        capabilities: getCapabilityFlags(),
      });
    } catch (err) {
      sanitizeDbError('auth.login', err);
    }
  })
);

// 4. POST /api/v1/auth/admin/login (Single-Custodian 4-point Admin Verification)
authRouter.post(
  '/admin/login',
  authRateLimiter,
  validateBody(adminLoginBodySchema),
  asyncHandler(async (req, res) => {
    const { userId, email, password, challengeId, challengeAnswer } = req.body;
    const ch = activeAdminChallenges.get(challengeId);
    activeAdminChallenges.delete(challengeId);

    if (!ch || ch.expiresAt < Date.now() || challengeAnswer.trim().toUpperCase() !== ch.code) {
      await recordDbAudit({
        action: 'ADMIN_CHALLENGE_FAILED',
        entity: 'AUTH',
        metadata: { email, userId, outcome: 'BLOCKED' },
        ip: req.ip,
      });
      throw new AppError(
        401,
        'INVALID_CHALLENGE',
        'Invalid or expired security verification code. Please enter the refreshed code.'
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCustodian = userId.trim();

    try {
      const adminRow = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (!adminRow) {
        await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
        throw new AppError(
          401,
          'ADMIN_UNAUTHORIZED',
          'Admin custodian account is not provisioned.'
        );
      }

      if (adminRow.lockedUntil && adminRow.lockedUntil.getTime() > Date.now()) {
        const retrySec = Math.ceil((adminRow.lockedUntil.getTime() - Date.now()) / 1000);
        throw new AppError(
          423,
          'ADMIN_LOCKED',
          `Too many failed security attempts. Admin console locked for ${retrySec}s.`
        );
      }

      const idOk = timingSafeStringMatch(cleanCustodian, adminRow.custodianCode || 'TPO-ADMIN-01');
      const emailOk = timingSafeStringMatch(cleanEmail, adminRow.email);
      const passOk = await bcrypt.compare(password, adminRow.passwordHash);

      if (!idOk || !emailOk || !passOk) {
        const nextFailed = (adminRow.failedLogins || 0) + 1;
        const lockedUntil = nextFailed >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
        await prisma.user.update({
          where: { id: adminRow.id },
          data: { failedLogins: nextFailed, lockedUntil, updatedAt: new Date() },
        });

        await recordDbAudit({
          actorId: adminRow.id,
          action: 'ADMIN_LOGIN_REJECTED',
          entity: 'USER',
          entityId: adminRow.id,
          metadata: { attemptedEmail: cleanEmail, attemptedId: cleanCustodian, outcome: 'BLOCKED' },
          ip: req.ip,
        });

        throw new AppError(
          401,
          'INVALID_ADMIN_CREDENTIALS',
          'Access denied. Admin Portal is restricted to a single authorized custodian (User ID, Email, and Password must all match).'
        );
      }

      await prisma.user.update({
        where: { id: adminRow.id },
        data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() },
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
        action: 'ADMIN_LOGGED_IN',
        entity: 'USER',
        entityId: adminRow.id,
        metadata: { actor: `${adminCustodian.userId} (${adminRow.email})`, outcome: 'SUCCESS' },
        ip: req.ip,
      });

      return sendSuccess(res, {
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: adminCustodian.userId,
          email: adminRow.email,
          name: adminCustodian.name,
          role: 'admin',
          title: adminCustodian.title,
          avatarUrl: adminCustodian.avatarUrl,
          avatarBg: adminCustodian.avatarBg,
          mustChangePassword: adminRow.mustChangePassword,
        },
        adminCustodian,
        capabilities: getCapabilityFlags(),
      });
    } catch (err) {
      sanitizeDbError('auth.adminLogin', err);
    }
  })
);

// 5. POST /api/v1/auth/oauth/google (Firebase ID token verification + DB student upsert)
authRouter.post(
  '/oauth/google',
  authRateLimiter,
  validateBody(googleOAuthBodySchema),
  asyncHandler(async (req, res) => {
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(req.body.idToken);
    } catch {
      throw new AppError(401, 'INVALID_ID_TOKEN', 'Google identity token could not be verified.');
    }

    if (!decoded.email) {
      throw new AppError(400, 'EMAIL_REQUIRED', 'Google account did not return a verified email.');
    }

    const cleanEmail = decoded.email.trim().toLowerCase();
    const adminCheck = await prisma.user.findFirst({
      where: { email: cleanEmail, role: 'ADMIN' },
    });
    if (adminCheck) {
      throw new AppError(
        403,
        'ADMIN_PORTAL_REQUIRED',
        'Administrator accounts must sign in through the TPO Admin Security Gateway.'
      );
    }

    const { user, studentProfile } = await getOrCreateStudentByFirebaseUid({
      uid: decoded.uid,
      email: cleanEmail,
      displayName: decoded.name,
    });

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This student account is deactivated.');
    }

    const tokens = await createSessionAndTokens({
      userId: user.id,
      role: 'STUDENT',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await recordDbAudit({
      actorId: user.id,
      action: 'STUDENT_GOOGLE_OAUTH_LOGIN',
      entity: 'USER',
      entityId: user.id,
      metadata: { email: cleanEmail, outcome: 'SUCCESS' },
      ip: req.ip,
    });

    return sendSuccess(res, {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        studentId: studentProfile.id,
        email: user.email,
        name: studentProfile.fullName,
        role: 'student',
        department: studentProfile.department || 'Computer Engg (CSE)',
        cgpa: toNumber(studentProfile.cgpa) ?? 8.1,
      },
      capabilities: getCapabilityFlags(),
    });
  })
);

// 6. POST /api/v1/auth/continue (Federated Student Sign-In backed by PostgreSQL)
authRouter.post(
  '/continue',
  authRateLimiter,
  validateBody(continueWithBodySchema),
  asyncHandler(async (req, res) => {
    const cleanEmail = req.body.email.trim().toLowerCase();
    const adminCheck = await prisma.user.findFirst({
      where: { email: cleanEmail, role: 'ADMIN' },
    });
    if (adminCheck) {
      throw new AppError(
        403,
        'ADMIN_PORTAL_REQUIRED',
        'Administrator accounts cannot use Student federated sign-in.'
      );
    }

    const { user, studentProfile } = await getOrCreateStudentByFirebaseUid({
      uid: `federated:${req.body.provider}:${cleanEmail}`,
      email: cleanEmail,
      displayName: req.body.name,
    });

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This student account is deactivated.');
    }

    const tokens = await createSessionAndTokens({
      userId: user.id,
      role: 'STUDENT',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await recordDbAudit({
      actorId: user.id,
      action: `STUDENT_FEDERATED_${req.body.provider.toUpperCase()}`,
      entity: 'USER',
      entityId: user.id,
      metadata: { email: cleanEmail, provider: req.body.provider, outcome: 'SUCCESS' },
      ip: req.ip,
    });

    return sendSuccess(res, {
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        studentId: studentProfile.id,
        email: user.email,
        name: studentProfile.fullName,
        role: 'student',
        department: studentProfile.department || 'Computer Engg (CSE)',
        cgpa: toNumber(studentProfile.cgpa) ?? 8.1,
      },
    });
  })
);

// 7. POST /api/v1/auth/refresh (Rotation + Reuse Detection revoking ALL user sessions)
authRouter.post(
  '/refresh',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const rawRefresh =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

    if (!rawRefresh) {
      throw new AppError(401, 'REFRESH_TOKEN_MISSING', 'Refresh token is required.');
    }

    const tokenHash = hashOpaqueToken(rawRefresh);
    try {
      const sessionRow = await prisma.userSession.findUnique({
        where: { refreshTokenHash: tokenHash },
      });

      if (!sessionRow) {
        clearAuthCookies(res);
        throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh session is invalid.');
      }

      if (sessionRow.revokedAt !== null) {
        await prisma.userSession.updateMany({
          where: { userId: sessionRow.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await recordDbAudit({
          actorId: sessionRow.userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entity: 'USER_SESSION',
          entityId: sessionRow.id,
          metadata: { outcome: 'BLOCKED', revokedAllUserSessions: true },
          ip: req.ip,
        });

        clearAuthCookies(res);
        throw new AppError(
          401,
          'REFRESH_TOKEN_REUSED',
          'Refresh token reuse detected. All active sessions have been revoked for security.'
        );
      }

      if (sessionRow.expiresAt.getTime() < Date.now()) {
        await prisma.userSession.update({
          where: { id: sessionRow.id },
          data: { revokedAt: new Date() },
        });
        clearAuthCookies(res);
        throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh session has expired.');
      }

      const userRow = await prisma.user.findUnique({
        where: { id: sessionRow.userId },
      });

      if (!userRow || !userRow.isActive) {
        clearAuthCookies(res);
        throw new AppError(401, 'USER_INACTIVE', 'Account is inactive.');
      }

      await prisma.userSession.update({
        where: { id: sessionRow.id },
        data: { revokedAt: new Date() },
      });

      const nextTokens = await createSessionAndTokens({
        userId: userRow.id,
        role: userRow.role,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setAuthCookies(res, nextTokens.accessToken, nextTokens.refreshToken);

      return sendSuccess(res, {
        accessToken: nextTokens.accessToken,
        refreshToken: nextTokens.refreshToken,
      });
    } catch (err) {
      sanitizeDbError('auth.refresh', err);
    }
  })
);

// 8. POST /api/v1/auth/logout
authRouter.post(
  '/logout',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const rawRefresh =
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

    try {
      if (rawRefresh) {
        const tokenHash = hashOpaqueToken(rawRefresh);
        await prisma.userSession.updateMany({
          where: { refreshTokenHash: tokenHash },
          data: { revokedAt: new Date() },
        });
      } else if (req.headers.authorization?.startsWith('Bearer ')) {
        const jwtRaw = req.headers.authorization.slice(7).trim();
        const parts = jwtRaw.split('.');
        if (parts.length === 3) {
          try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
              sessionId?: string;
            };
            if (payload.sessionId) {
              await prisma.userSession.updateMany({
                where: { id: payload.sessionId },
                data: { revokedAt: new Date() },
              });
            }
          } catch {
            // Ignore malformed bearer on logout
          }
        }
      }
    } catch {
      // Non-fatal on logout
    }

    clearAuthCookies(res);
    return sendSuccess(res, { loggedOut: true }, 'Logged out');
  })
);

// 9. GET /api/v1/auth/me
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ctx = req.auth!;
    const userRow = await prisma.user.findUnique({ where: { id: ctx.userId } });
    if (!userRow || !userRow.isActive) {
      throw new AppError(401, 'UNAUTHORIZED', 'Account is unavailable.');
    }

    if (userRow.role === 'ADMIN') {
      const adminCustodian = buildPublicAdminCustodian(userRow);
      return sendSuccess(res, {
        user: {
          id: adminCustodian.userId,
          userId: userRow.id,
          email: userRow.email,
          name: adminCustodian.name,
          role: 'ADMIN',
          title: adminCustodian.title,
          avatarUrl: adminCustodian.avatarUrl,
          avatarBg: adminCustodian.avatarBg,
          mustChangePassword: userRow.mustChangePassword,
        },
        adminCustodian,
        capabilities: getCapabilityFlags(),
      });
    }

    const stu = await prisma.studentProfile.findUnique({
      where: { userId: userRow.id },
    });

    return sendSuccess(res, {
      user: {
        id: userRow.id,
        studentId: stu?.id ?? null,
        email: userRow.email,
        name: stu?.fullName || ctx.fullName,
        fullName: stu?.fullName || ctx.fullName,
        role: 'STUDENT',
        department: stu?.department || 'Computer Engg (CSE)',
        cgpa: toNumber(stu?.cgpa),
        completionPct: stu?.completionPct ?? 0,
        avatarUrl: stu?.avatarUrl ?? '',
        avatarBg: stu?.avatarBg ?? 'indigo',
        mustChangePassword: userRow.mustChangePassword,
      },
      capabilities: getCapabilityFlags(),
    });
  })
);

// 10. POST /api/v1/auth/forgot-password
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordBodySchema),
  asyncHandler(async (req, res) => {
    const { emailEnabled } = getCapabilityFlags();
    if (!emailEnabled) {
      throw new AppError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured');
    }

    const cleanEmail = req.body.email.trim().toLowerCase();
    try {
      const userRow = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (userRow && userRow.isActive) {
        const rawReset = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashOpaqueToken(rawReset);
        await prisma.passwordResetToken.create({
          data: {
            userId: userRow.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
        await sendTransactionalEmail({
          to: cleanEmail,
          subject: 'Placement Bridge — Password Reset Request',
          text: `Use your one-time password reset token within 30 minutes.`,
        });
      }

      return sendSuccess(
        res,
        { accepted: true },
        'If an account exists for that email, password reset instructions have been sent.'
      );
    } catch (err) {
      sanitizeDbError('auth.forgotPassword', err);
    }
  })
);

// 11. POST /api/v1/auth/reset-password
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordBodySchema),
  asyncHandler(async (req, res) => {
    const tokenHash = hashOpaqueToken(req.body.token);
    try {
      const resetRow = await prisma.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null },
      });

      if (!resetRow || resetRow.expiresAt.getTime() < Date.now()) {
        throw new AppError(
          400,
          'INVALID_RESET_TOKEN',
          'Password reset token is invalid or expired.'
        );
      }

      const newHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.update({
          where: { id: resetRow.id },
          data: { usedAt: new Date() },
        });

        await tx.user.update({
          where: { id: resetRow.userId },
          data: {
            passwordHash: newHash,
            mustChangePassword: false,
            failedLogins: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          },
        });

        await tx.userSession.updateMany({
          where: { userId: resetRow.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });

      clearAuthCookies(res);
      return sendSuccess(res, { reset: true }, 'Password has been reset. Please log in again.');
    } catch (err) {
      sanitizeDbError('auth.resetPassword', err);
    }
  })
);

// 12. PUT /api/v1/auth/change-password
authRouter.put(
  '/change-password',
  authenticate,
  validateBody(changePasswordBodySchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const ctx = req.auth!;
    try {
      const userRow = await prisma.user.findUnique({ where: { id: ctx.userId } });
      if (!userRow) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
      }

      const ok = await bcrypt.compare(req.body.currentPassword, userRow.passwordHash);
      if (!ok) {
        throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
      }

      const newHash = await bcrypt.hash(req.body.newPassword, 12);
      await prisma.user.update({
        where: { id: userRow.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        },
      });

      if (ctx.sessionId) {
        await prisma.userSession.updateMany({
          where: {
            userId: userRow.id,
            id: { not: ctx.sessionId },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }

      await recordDbAudit({
        actorId: userRow.id,
        action: 'PASSWORD_CHANGED',
        entity: 'USER',
        entityId: userRow.id,
        ip: req.ip,
      });

      return sendSuccess(res, { changed: true }, 'Password updated and other sessions revoked.');
    } catch (err) {
      sanitizeDbError('auth.changePassword', err);
    }
  })
);

export { ACCESS_COOKIE_NAME };
