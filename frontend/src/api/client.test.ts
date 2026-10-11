import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, setUnauthorizedHandler } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws ApiError carrying status, code, and message from the error envelope', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, { error: { code: 'CONFLICT', message: 'Already reviewed' } }),
    );

    const error = await api.get('/api/vouchers').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe('CONFLICT');
    expect((error as ApiError).message).toBe('Already reviewed');
  });

  it('sends credentials: include on every request', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { ok: true }));

    await api.get('/api/auth/me');

    const init = fetchSpy.mock.calls[0]![1]!;
    expect(init.credentials).toBe('include');
  });

  it('calls the registered onUnauthorized handler exactly once on a 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
    );
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await api.get('/api/vouchers').catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('serializes params, dropping undefined and empty-string values', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { data: [] }));

    await api.get('/api/vouchers', { status: 'APPROVED', q: '', page: 2, department: undefined });

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain('status=APPROVED');
    expect(url).toContain('page=2');
    expect(url).not.toContain('q=');
    expect(url).not.toContain('department');
  });
});
