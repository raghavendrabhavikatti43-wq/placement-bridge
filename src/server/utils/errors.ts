import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { logger, scrubConnectionUris } from '../config/logger.ts';

export interface FieldValidationError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: FieldValidationError[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    errors?: FieldValidationError[],
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
  }
}

/**
 * Two-Layer Error Handling — Layer 1 (Prisma / PostgreSQL Sanitization):
 * Translates known Prisma constraint codes cleanly and logs internal DB exceptions
 * server-side with URI scrubbing so credentials, schemas, and SQL statements are
 * never leaked to clients.
 */
export function sanitizeDbError(context: string, error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'UNIQUE_CONSTRAINT',
        'A record with these unique details already exists.'
      );
    }
    if (error.code === 'P2025') {
      throw new AppError(404, 'RECORD_NOT_FOUND', 'The requested record does not exist.');
    }
    if (error.code === 'P2003') {
      throw new AppError(
        400,
        'FOREIGN_KEY_CONSTRAINT',
        'A referenced record could not be found.'
      );
    }
  }

  const safeMessage =
    error instanceof Error ? scrubConnectionUris(error.message) : 'Unknown database error';
  logger.error({ context, reason: safeMessage }, 'Database query failed');

  throw new AppError(
    500,
    'DATABASE_ERROR',
    'A database operation could not be completed. Please try again shortly.'
  );
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
