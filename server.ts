import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { disconnectPrisma } from './src/db/prisma.ts';
import { ensureSeededOnce } from './src/db/seed.ts';
import { createApiApp } from './src/server/app.ts';
import { env } from './src/server/config/env.ts';
import { logger } from './src/server/config/logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = createApiApp();

  // Trigger non-blocking idempotent seed verification when first API request arrives
  let seedTriggered = false;
  app.use('/api', (_req, _res, next) => {
    if (!seedTriggered) {
      seedTriggered = true;
      ensureSeededOnce().catch((err) => {
        logger.warn({ err }, 'Lazy seed check skipped or deferred');
      });
    }
    next();
  });

  if (env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, env: env.NODE_ENV }, 'Placement Bridge full-stack server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, 'Fatal error starting Placement Bridge server');
  process.exit(1);
});
