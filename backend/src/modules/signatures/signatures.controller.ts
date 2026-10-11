import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  assertFilePresent,
  createSignatureRecord,
  getSignatureFile,
} from './signatures.service.js';

export async function uploadSignatureController(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  const file = assertFilePresent(req.file);
  const signature = await createSignatureRecord(req.user.id, file);

  res.status(201).json({
    signature: {
      id: signature.id,
      mimeType: signature.mimeType,
      sizeBytes: signature.sizeBytes,
      createdAt: signature.createdAt,
    },
  });
}

export async function getSignatureImageController(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  const { absolutePath, mimeType } = await getSignatureFile(req.user, req.params.id as string);

  res.type(mimeType);
  // dotfiles: 'allow' because UPLOAD_DIR may sit under a dotted directory and
  // the default 'ignore' would 404 a file that exists. The path is never
  // client-supplied: it is a UUID filename resolved from our own row.
  res.sendFile(absolutePath, { dotfiles: 'allow' }, (error) => {
    if (error && !res.headersSent) {
      // The row exists but its file does not — a missing upload directory, a
      // hand-edited database. Report it as not found rather than as a 500.
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Signature image not found' } });
    }
  });
}
