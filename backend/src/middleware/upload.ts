import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import multer from 'multer';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { UnsupportedMediaTypeError } from '../lib/errors.js';

export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const EXTENSION: Record<AllowedMimeType, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

/** Absolute path of the directory signature files are written to. */
export const uploadRoot = resolve(process.cwd(), env.UPLOAD_DIR);

mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    mkdirSync(uploadRoot, { recursive: true });
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    // The extension comes from the declared type, never from the client's
    // filename — "../../etc/passwd.png" must not influence the path.
    const ext = EXTENSION[file.mimetype as AllowedMimeType] ?? '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const uploadSignature: RequestHandler = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as AllowedMimeType)) {
      cb(new UnsupportedMediaTypeError(`Unsupported file type: ${file.mimetype}`));
      return;
    }
    cb(null, true);
  },
}).single('image');
