import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import type { FileAsset } from '@prisma/client';
import { prisma } from '../../db/prisma.ts';
import { env } from '../config/env.ts';
import { AppError, sanitizeDbError } from '../utils/errors.ts';

export type UploadPurpose =
  | 'PROFILE_IMAGE'
  | 'RESUME'
  | 'CERTIFICATE'
  | 'COMPANY_LOGO'
  | 'GENERATED_RESUME';

interface PurposePolicy {
  maxBytes: number;
  allowedExts: string[];
  allowedMimes: string[];
}

const POLICIES: Record<UploadPurpose, PurposePolicy> = {
  PROFILE_IMAGE: {
    maxBytes: 2 * 1024 * 1024,
    allowedExts: ['.png', '.jpg', '.jpeg', '.webp'],
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  COMPANY_LOGO: {
    maxBytes: 1 * 1024 * 1024,
    allowedExts: ['.png', '.jpg', '.jpeg', '.webp'],
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp'],
  },
  RESUME: {
    maxBytes: 2 * 1024 * 1024,
    allowedExts: ['.pdf', '.docx'],
    allowedMimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
    ],
  },
  CERTIFICATE: {
    maxBytes: 5 * 1024 * 1024,
    allowedExts: ['.pdf', '.png', '.jpg', '.jpeg'],
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg'],
  },
  GENERATED_RESUME: {
    maxBytes: 5 * 1024 * 1024,
    allowedExts: ['.pdf'],
    allowedMimes: ['application/pdf'],
  },
};

const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), 'storage');

export async function validateAndStoreFile(params: {
  ownerId: string | null;
  kind: UploadPurpose;
  originalName: string;
  buffer: Buffer;
  declaredMime?: string;
}) {
  const policy = POLICIES[params.kind];
  if (!params.buffer || params.buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'Uploaded file buffer is empty.');
  }
  if (params.buffer.length > policy.maxBytes) {
    throw new AppError(
      413,
      'FILE_TOO_LARGE',
      `File exceeds maximum allowed size (${Math.round(policy.maxBytes / (1024 * 1024))} MB).`
    );
  }

  const cleanOriginal = path
    .basename(params.originalName || 'upload.bin')
    .replace(/[^\w.\- ()]/g, '_');
  const ext = path.extname(cleanOriginal).toLowerCase();
  if (!policy.allowedExts.includes(ext)) {
    throw new AppError(
      400,
      'INVALID_FILE_EXTENSION',
      `Allowed file extensions for ${params.kind}: ${policy.allowedExts.join(', ')}`
    );
  }

  const detected = await fileTypeFromBuffer(params.buffer);
  if (!detected || !policy.allowedMimes.includes(detected.mime)) {
    throw new AppError(
      400,
      'MAGIC_BYTE_MISMATCH',
      `File binary signature (${detected?.mime || 'unknown'}) does not match allowed format for ${params.kind}.`
    );
  }

  const effectiveMime =
    ext === '.docx' &&
    (detected.mime === 'application/zip' || detected.mime.includes('wordprocessingml'))
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : detected.mime;

  const checksum = crypto.createHash('sha256').update(params.buffer).digest('hex');
  const storageKey = `${params.kind.toLowerCase()}/${params.ownerId || 'system'}/${crypto.randomUUID()}${ext}`;

  if (env.STORAGE_PROVIDER === 'local') {
    const dest = path.join(LOCAL_STORAGE_ROOT, storageKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, params.buffer);
  }

  try {
    const asset = await prisma.fileAsset.create({
      data: {
        ownerId: params.ownerId,
        kind: params.kind,
        storageKey,
        originalName: cleanOriginal,
        mimeType: effectiveMime,
        sizeBytes: params.buffer.length,
        checksum,
        contentBase64: params.buffer.toString('base64'),
      },
      select: {
        id: true,
        ownerId: true,
        kind: true,
        storageKey: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        checksum: true,
        createdAt: true,
      },
    });

    return asset;
  } catch (err) {
    sanitizeDbError('validateAndStoreFile', err);
  }
}

export async function readStoredFileBuffer(assetId: string): Promise<{
  asset: FileAsset;
  buffer: Buffer;
}> {
  let asset: FileAsset | null = null;
  try {
    asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
  } catch (err) {
    sanitizeDbError('readStoredFileBuffer', err);
  }

  if (!asset) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'Requested file asset does not exist.');
  }

  if (asset.contentBase64) {
    return { asset, buffer: Buffer.from(asset.contentBase64, 'base64') };
  }

  const localPath = path.join(LOCAL_STORAGE_ROOT, asset.storageKey);
  try {
    const buffer = await fs.readFile(localPath);
    return { asset, buffer };
  } catch {
    throw new AppError(404, 'FILE_BLOB_MISSING', 'Underlying file object is unavailable.');
  }
}

export async function deleteStoredFile(assetId: string): Promise<void> {
  let asset: FileAsset | null = null;
  try {
    asset = await prisma.fileAsset.findUnique({ where: { id: assetId } });
    if (asset) {
      await prisma.fileAsset.delete({ where: { id: assetId } });
    }
  } catch (err) {
    sanitizeDbError('deleteStoredFile', err);
  }

  if (asset && env.STORAGE_PROVIDER === 'local') {
    const localPath = path.join(LOCAL_STORAGE_ROOT, asset.storageKey);
    await fs.unlink(localPath).catch(() => undefined);
  }
}

export function createSignedFileUrl(assetId: string, ttlSec = 600): {
  signedUrl: string;
  expiresAt: string;
} {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${assetId}.${exp}`;
  const sig = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(payload)
    .digest('base64url');
  return {
    signedUrl: `/api/v1/files/${assetId}/download?exp=${exp}&sig=${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifySignedFileUrl(assetId: string, expRaw: string, sig: string): boolean {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${assetId}.${exp}`)
    .digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
