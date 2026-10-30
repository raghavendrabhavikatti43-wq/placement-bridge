import { Response, Request } from 'express';
import type { FieldValidationError } from './errors.ts';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'ok',
  statusCode = 200,
  meta?: PaginationMeta | Record<string, unknown>
) {
  const payload: Record<string, unknown> = {
    success: true,
    message,
    data,
  };
  if (meta) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  errors?: FieldValidationError[]
) {
  const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';
  return res.status(statusCode).json({
    success: false,
    message,
    errors: errors ?? [],
    code,
    requestId,
  });
}

export function parsePagination(query: Record<string, unknown>, defaultSize = 20, maxSize = 100) {
  const rawPage = Number(query.page ?? 1);
  const rawSize = Number(query.pageSize ?? defaultSize);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(maxSize, Math.floor(rawSize)) : defaultSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Escapes CSV cell values to prevent spreadsheet formula injection (=, +, -, @, tab, CR).
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
