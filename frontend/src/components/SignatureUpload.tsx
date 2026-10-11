import { useRef, useState } from 'react';
import { signaturesApi } from '../api/signatures';
import { ApiError } from '../api/client';
import { SignatureImage } from './SignatureImage';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * The type and size checks here are a courtesy — they save a round trip. The
 * backend re-checks both, and also checks the bytes, because nothing the
 * browser reports about a file can be trusted.
 */
export function SignatureUpload({
  value,
  onChange,
  label = 'Signature',
}: {
  value: string | null;
  onChange: (signatureId: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('The image must be 2 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const signature = await signaturesApi.upload(file);
      onChange(signature.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <span className="block text-sm font-medium text-slate-700">{label}</span>

      {value && (
        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2">
          <SignatureImage signatureId={value} alt={`${label} preview`} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        disabled={uploading}
        aria-label={`Upload ${label.toLowerCase()}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
        className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800 disabled:opacity-60"
      />

      {uploading && <p className="mt-1 text-sm text-slate-500">Uploading…</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
      {!value && !uploading && (
        <p className="mt-1 text-xs text-slate-500">
          PNG, JPEG, or WebP, up to 2 MB. Required before submitting.
        </p>
      )}
    </div>
  );
}
