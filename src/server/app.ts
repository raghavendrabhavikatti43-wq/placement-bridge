import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from '../db/prisma.ts';
import { env, getCapabilityFlags } from './config/env.ts';
import {
  corsMiddleware,
  errorHandler,
  globalApiLimiter,
  notFoundHandler,
  requestIdMiddleware,
  securityHeadersMiddleware,
} from './middleware/security.ts';
import { authenticate, requireRole } from './middleware/auth.ts';
import { authRouter } from './routes/auth.routes.ts';
import { studentRouter } from './routes/student.routes.ts';
import { companiesRouter } from './routes/companies.routes.ts';
import { prepRouter } from './routes/prep.routes.ts';
import { practiceRouter } from './routes/practice.routes.ts';
import { resumeAiRouter } from './routes/resumeAi.routes.ts';
import { progressRouter } from './routes/progress.routes.ts';
import { adminRouter } from './routes/admin.routes.ts';
import { legacyCompatRouter } from './routes/legacyCompat.routes.ts';
import { sendSuccess } from './utils/response.ts';

export function createApiApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });

  app.use('/api', globalApiLimiter);

  // ==========================================================================
  // 1. HEALTH & CAPABILITIES ENDPOINT (Part F1 — Neon PostgreSQL via Prisma)
  // ==========================================================================
  app.get('/api/v1/health', async (_req, res) => {
    let dbHealthy = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    const capabilities = getCapabilityFlags();
    return sendSuccess(
      res,
      {
        status: dbHealthy ? 'ok' : 'degraded',
        database: dbHealthy ? 'connected' : 'unreachable',
        ...capabilities,
        timestamp: new Date().toISOString(),
      },
      dbHealthy ? 'Placement Bridge API healthy' : 'Database unreachable',
      dbHealthy ? 200 : 503
    );
  });

  // ==========================================================================
  // 2. OPENAPI SPECIFICATION ENDPOINT (Dev public, Prod ADMIN-only)
  // ==========================================================================
  const serveOpenApiSpec = async (_req: express.Request, res: express.Response) => {
    try {
      const specPath = path.resolve(process.cwd(), 'backend/docs/openapi.yaml');
      const yaml = await fs.readFile(specPath, 'utf8');
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      res.status(200).send(yaml);
    } catch {
      res.status(404).json({ success: false, message: 'OpenAPI specification file not found.' });
    }
  };

  if (env.NODE_ENV === 'production') {
    app.get('/api/docs', authenticate, requireRole('ADMIN'), serveOpenApiSpec);
  } else {
    app.get('/api/docs', serveOpenApiSpec);
  }

  // ==========================================================================
  // 3. CANONICAL /api/v1/* MODULAR ROUTERS (Part F1–F17)
  // ==========================================================================
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', studentRouter);
  app.use('/api/v1', companiesRouter);
  app.use('/api/v1', prepRouter);
  app.use('/api/v1', practiceRouter);
  app.use('/api/v1', resumeAiRouter);
  app.use('/api/v1', progressRouter);
  app.use('/api/v1/admin', adminRouter);

  // ==========================================================================
  // 4. POSTGRESQL-BACKED /api/* COMPATIBILITY ROUTES FOR EXISTING FRONTEND
  // ==========================================================================
  app.use('/api', legacyCompatRouter);

  // 404 handler strictly for unmatched /api/* routes (allows Vite SPA catch-all for non-API paths)
  app.use('/api', notFoundHandler);

  // Centralized two-layer sanitized error handler
  app.use(errorHandler);

  return app;
}
