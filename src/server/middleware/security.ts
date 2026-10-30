import crypto from 'node:crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ZodTypeAny, ZodError } from 'zod';
import { env } from '../config/env.ts';
import { logger } from '../config/logger.ts';
import { AppError } from '../utils/errors.ts';
import { sendError } from '../utils/response.ts';

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0 && incoming.length <= 64
      ? incoming.trim()
      : crypto.randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

/**
 * Iframe-safe Helmet configuration so AI Studio preview iframe renders without X-Frame-Options blocking,
 * while enforcing nosniff, referrer-policy, DNS prefetch control, and HSTS headers.
 */
export const securityHeadersMiddleware = helmet({
  frameguard: false,
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false, // Required for Firebase signInWithPopup window communication
});

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Same-origin requests or unconfigured allow-list in dev preview
    if (!origin || env.corsOriginsList.length === 0) {
      callback(null, true);
      return;
    }
    if (env.corsOriginsList.includes(origin) || (env.APP_URL && origin === env.APP_URL)) {
      callback(null, true);
      return;
    }
    callback(new AppError(403, 'CORS_NOT_ALLOWED', 'Origin is not permitted by CORS policy.'));
  },
  credentials: true,
});

export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
    code: 'RATE_LIMITED',
    errors: [],
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.',
    code: 'AUTH_RATE_LIMITED',
    errors: [],
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.AI_RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Hourly AI request limit reached. Deterministic placement tools remain available.',
    code: 'AI_RATE_LIMITED',
    errors: [],
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many file uploads. Please wait a few minutes.',
    code: 'UPLOAD_RATE_LIMITED',
    errors: [],
  },
});

export function validateBody<T extends ZodTypeAny>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }));
      next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', issues));
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(req, res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`);
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    // Also include `error: err.message` at top-level so legacy frontend callers reading `data.error` work seamlessly!
    const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: err.message,
      errors: err.errors ?? [],
      code: err.code,
      requestId,
    });
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      field: i.path.join('.') || 'input',
      message: i.message,
    }));
    const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: issues[0]?.message || 'Validation failed',
      errors: issues,
      code: 'VALIDATION_ERROR',
      requestId,
    });
    return;
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled API error');
  const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: 'Internal server error',
    errors: [],
    code: 'INTERNAL_ERROR',
    requestId,
  });
};
