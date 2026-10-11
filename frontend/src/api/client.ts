export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type UnauthorizedHandler = (() => void) | null;

let onUnauthorized: UnauthorizedHandler = null;

/**
 * Registered by AuthContext so a 401 from anywhere clears the session and
 * returns the user to the login screen, rather than leaving a dead page.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, params?: QueryParams): string {
  if (!params) return path;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // An empty filter is an absent filter, not a filter for the empty string.
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

async function toError(response: Response): Promise<ApiError> {
  let code = 'UNKNOWN';
  let message = `Request failed with status ${response.status}`;
  let details: unknown;

  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    }
  } catch {
    // A non-JSON error body (a proxy failure, say) keeps the defaults.
  }

  return new ApiError(response.status, code, message, details);
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init });

  if (response.status === 401) {
    onUnauthorized?.();
    throw await toError(response);
  }

  if (!response.ok) throw await toError(response);

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;

  return (await response.json()) as T;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export const api = {
  get: <T>(path: string, params?: QueryParams): Promise<T> =>
    send<T>(withQuery(path, params), { method: 'GET' }),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    send<T>(path, {
      method: 'POST',
      headers: jsonHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown): Promise<T> =>
    send<T>(path, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(body) }),

  del: (path: string): Promise<void> => send<void>(path, { method: 'DELETE' }),

  postForm: <T>(path: string, form: FormData): Promise<T> =>
    // No Content-Type header: the browser must set the multipart boundary.
    send<T>(path, { method: 'POST', body: form }),
};
