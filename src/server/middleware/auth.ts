import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, Prisma } from '../../db/prisma.ts';
import { getOrCreateStudentByFirebaseUid } from '../../db/users.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import { env } from '../config/env.ts';
import { AppError, sanitizeDbError } from '../utils/errors.ts';

export const ACCESS_COOKIE_NAME = 'pb_access_token';
export const REFRESH_COOKIE_NAME = 'pb_refresh_token';

export interface AccessJwtPayload {
  sub: string; // users.id (UUID)
  role: 'STUDENT' | 'ADMIN';
  sessionId: string; // user_sessions.id (UUID)
}

export interface AuthenticatedContext {
  userId: string;
  uid: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
  sessionId?: string;
  studentId?: string;
  fullName: string;
  custodianCode?: string | null;
}

export type AuthenticatedRequest = Request & {
  auth?: AuthenticatedContext;
};

export function hashOpaqueToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function signAccessJwt(payload: AccessJwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
  });
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = env.NODE_ENV === 'production';
  const sameSiteMode: 'lax' | 'none' = isProd ? 'none' : 'lax';
  const secureFlag = isProd;

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: secureFlag,
    sameSite: sameSiteMode,
    maxAge: 15 * 60 * 1000,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: secureFlag,
    sameSite: sameSiteMode,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
}

export async function recordDbAudit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Non-blocking audit insert
  }
}

async function resolveAuthFromRequest(req: Request): Promise<AuthenticatedContext | null> {
  const bearerHeader = req.headers.authorization;
  const bearerToken =
    bearerHeader && bearerHeader.startsWith('Bearer ')
      ? bearerHeader.slice(7).trim()
      : undefined;
  const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;

  const rawToken = bearerToken || cookieToken;
  if (!rawToken) return null;

  // 1. Try verifying our signed Access JWT first via single relational Prisma lookup
  try {
    const decoded = jwt.verify(rawToken, env.JWT_ACCESS_SECRET) as AccessJwtPayload;
    if (decoded?.sub && decoded?.sessionId) {
      const sessionRow = await prisma.userSession.findFirst({
        where: {
          id: decoded.sessionId,
          userId: decoded.sub,
          revokedAt: null,
        },
        include: {
          user: {
            include: {
              student: true,
            },
          },
        },
      });

      if (!sessionRow || sessionRow.expiresAt.getTime() < Date.now()) {
        return null;
      }

      const userRow = sessionRow.user;
      if (!userRow || !userRow.isActive) {
        return null;
      }

      if (userRow.role === 'STUDENT') {
        const stu = userRow.student;
        return {
          userId: userRow.id,
          uid: userRow.uid,
          email: userRow.email,
          role: 'STUDENT',
          sessionId: sessionRow.id,
          studentId: stu?.id,
          fullName: stu?.fullName || userRow.email.split('@')[0],
        };
      }

      const adminMeta = (userRow.adminMeta || {}) as { name?: string };
      return {
        userId: userRow.id,
        uid: userRow.uid,
        email: userRow.email,
        role: 'ADMIN',
        sessionId: sessionRow.id,
        fullName: adminMeta.name || 'Dr. Rajesh Verma',
        custodianCode: userRow.custodianCode,
      };
    }
  } catch {
    // Not a local Access JWT or expired — fall through to Firebase ID Token verification
  }

  // 2. Verify Firebase Auth ID Token (Google Sign-In via `firebase-admin`)
  if (bearerToken && bearerToken.split('.').length === 3) {
    try {
      const firebaseDecoded = await adminAuth.verifyIdToken(bearerToken);
      if (firebaseDecoded?.uid && firebaseDecoded?.email) {
        const synced = await getOrCreateStudentByFirebaseUid({
          uid: firebaseDecoded.uid,
          email: firebaseDecoded.email,
          displayName: firebaseDecoded.name,
        });
        if (!synced.user.isActive) return null;
        return {
          userId: synced.user.id,
          uid: synced.user.uid,
          email: synced.user.email,
          role: synced.user.role,
          studentId: synced.studentProfile.id,
          fullName: synced.studentProfile.fullName,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const ctx = await resolveAuthFromRequest(req);
    if (!ctx) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required. Session invalid or expired.'));
      return;
    }
    req.auth = ctx;
    next();
  } catch (err) {
    try {
      sanitizeDbError('authenticate', err);
    } catch (sanitized) {
      next(sanitized);
    }
  }
}

export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const ctx = await resolveAuthFromRequest(req);
    if (ctx) req.auth = ctx;
    next();
  } catch {
    next();
  }
}

export function requireRole(...roles: ('STUDENT' | 'ADMIN')[]) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      await recordDbAudit({
        actorId: req.auth.userId,
        action: 'RBAC_ACCESS_BLOCKED',
        entity: 'ROUTE',
        entityId: req.originalUrl,
        metadata: { actorEmail: req.auth.email, actorRole: req.auth.role, outcome: 'BLOCKED' },
        ip: req.ip,
      });
      next(
        new AppError(
          403,
          'FORBIDDEN',
          `Access denied. Strictly restricted to ${roles.join('/')} accounts.`
        )
      );
      return;
    }
    if (roles.includes('STUDENT') && req.auth.role === 'STUDENT' && !req.auth.studentId) {
      next(new AppError(403, 'STUDENT_PROFILE_MISSING', 'Student profile record not found.'));
      return;
    }
    next();
  };
}
