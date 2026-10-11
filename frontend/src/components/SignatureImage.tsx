import { useEffect, useState } from 'react';
import { signaturesApi } from '../api/signatures';

/**
 * Signature images come from an authorization-checked endpoint, so they are
 * fetched with credentials and rendered from an object URL rather than pointed
 * at directly with a src the browser would load without the session cookie in
 * some contexts.
 */
export function SignatureImage({
  signatureId,
  alt,
  className,
}: {
  signatureId: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setFailed(false);
    setUrl(null);

    fetch(signaturesApi.imageUrl(signatureId), { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signatureId]);

  if (failed) {
    return <p className="text-sm text-slate-500">Signature unavailable</p>;
  }

  if (!url) {
    return <div className="h-16 w-40 animate-pulse rounded bg-slate-100" />;
  }

  return <img src={url} alt={alt} className={className ?? 'h-16 w-auto object-contain'} />;
}
