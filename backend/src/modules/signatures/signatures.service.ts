import { open, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Signature } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, UnsupportedMediaTypeError, ValidationError } from '../../lib/errors.js';
import { uploadRoot } from '../../middleware/upload.js';
import type { PublicUser } from '../auth/auth.service.js';

/**
 * Both the declared MIME type and the file extension are client-controlled, so
 * neither proves what the bytes are. Read the signature from the header.
 */
async function readMagic(absolutePath: string, length = 12): Promise<Buffer> {
  const handle = await open(absolutePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function looksLikeImage(magic: Buffer): boolean {
  if (magic.length >= 8 && magic.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return true; // PNG
  }
  if (magic.length >= 3 && magic.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return true; // JPEG
  }
  if (
    magic.length >= 12 &&
    magic.subarray(0, 4).toString('ascii') === 'RIFF' &&
    magic.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true; // WebP
  }
  return false;
}

/**
 * Validate the bytes Multer wrote and record the signature. A file that fails
 * validation is removed, so a rejected upload leaves nothing behind.
 */
export async function createSignatureRecord(
  ownerId: string,
  file: Express.Multer.File,
): Promise<Signature> {
  const absolutePath = resolve(uploadRoot, file.filename);

  if (file.size === 0) {
    await unlink(absolutePath).catch(() => undefined);
    throw new UnsupportedMediaTypeError('The uploaded file is empty');
  }

  const magic = await readMagic(absolutePath);
  if (!looksLikeImage(magic)) {
    await unlink(absolutePath).catch(() => undefined);
    throw new UnsupportedMediaTypeError('The uploaded file is not a PNG, JPEG, or WebP image');
  }

  return prisma.signature.create({
    data: {
      ownerId,
      filePath: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });
}

export function assertFilePresent(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new ValidationError('A signature image is required');
  return file;
}

/**
 * A caller may see a signature when they own it, when their role sees every
 * voucher, or when it is attached to a voucher they created.
 */
export async function canViewSignature(viewer: PublicUser, signatureId: string): Promise<boolean> {
  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
    select: { ownerId: true },
  });

  if (!signature) return false;
  if (signature.ownerId === viewer.id) return true;
  if (viewer.role === 'DIRECTOR' || viewer.role === 'ACCOUNTS') return true;

  const attachedToOwnVoucher = await prisma.voucher.findFirst({
    where: {
      createdById: viewer.id,
      OR: [{ employeeSignatureId: signatureId }, { directorSignatureId: signatureId }],
    },
    select: { id: true },
  });

  return attachedToOwnVoucher !== null;
}

/**
 * Resolve a signature to a file on disk. Throws NotFoundError rather than
 * ForbiddenError when the caller may not see it, so the endpoint does not
 * confirm that an id exists.
 */
export async function getSignatureFile(
  viewer: PublicUser,
  signatureId: string,
): Promise<{ absolutePath: string; mimeType: string }> {
  if (!(await canViewSignature(viewer, signatureId))) {
    throw new NotFoundError('Signature not found');
  }

  const signature = await prisma.signature.findUnique({ where: { id: signatureId } });
  if (!signature) throw new NotFoundError('Signature not found');

  return { absolutePath: resolve(uploadRoot, signature.filePath), mimeType: signature.mimeType };
}
