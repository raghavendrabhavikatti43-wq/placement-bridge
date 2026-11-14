import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/server/app.ts';

const app = createApiApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    return app(req, res);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('[Vercel Serverless Function Error]:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          success: false,
          error: 'FUNCTION_INVOCATION_ERROR',
          message: error?.message || 'Server error occurred inside Vercel Function',
        })
      );
    }
  }
}
