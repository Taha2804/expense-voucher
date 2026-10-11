import { api } from './client';
import type { Signature } from '../types';

export const signaturesApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return api.postForm<{ signature: Signature }>('/api/signatures', form).then((r) => r.signature);
  },

  imageUrl: (signatureId: string) => `/api/signatures/${signatureId}/image`,
};
