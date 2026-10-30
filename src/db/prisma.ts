import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Normalizes Neon PostgreSQL connection strings for Prisma Client at runtime:
 * - Reads strictly from server-side `process.env.DATABASE_URL`.
 * - Enforces `sslmode=require` if omitted on Neon hosts.
 * - Automatically appends `pgbouncer=true` and `connect_timeout=15` when connected
 *   to a Neon `-pooler` (PgBouncer transaction-mode) endpoint so concurrent Prisma
 *   queries never encounter prepared-statement collisions.
 * - Never logs or exposes credentials.
 */
function buildNormalizedDatasourceUrl(): string {
  const raw = (process.env.DATABASE_URL || '').trim();
  if (!raw) {
    throw new Error(
      'Server configuration error: DATABASE_URL environment secret is missing. Configure your Neon PostgreSQL connection string as DATABASE_URL in Google AI Studio Secrets.'
    );
  }

  try {
    const parsed = new URL(raw);
    const isNeon = parsed.hostname.endsWith('.neon.tech');
    const isPooler = parsed.hostname.includes('-pooler');

    if (isNeon && !parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require');
    }
    if (isPooler && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '15');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '30');
    }
    if (isPooler && !parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '10');
    }

    return parsed.toString();
  } catch {
    throw new Error(
      'Server configuration error: DATABASE_URL is not a valid PostgreSQL connection URI.'
    );
  }
}

declare global {
  var _placementBridgePrisma: PrismaClient | undefined;
}

function createPrismaSingleton(): PrismaClient {
  const datasourceUrl = buildNormalizedDatasourceUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: ['error'],
  });
}

export const prisma: PrismaClient =
  globalThis._placementBridgePrisma ?? createPrismaSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis._placementBridgePrisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect().catch(() => undefined);
}

export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export { Prisma };
