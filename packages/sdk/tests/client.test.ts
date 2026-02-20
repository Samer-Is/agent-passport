import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentPassportClient } from '../src/client.js';
import {
  PassportError,
  PassportAuthError,
  PassportRateLimitError,
  PassportNetworkError,
  PassportValidationError,
} from '../src/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      statusText: resp.status === 200 ? 'OK' : `Error ${resp.status}`,
      headers: new Headers(resp.headers ?? {}),
      json: async () => resp.body,
    } as unknown as Response;
  });
}

function createClient(fetchImpl: typeof globalThis.fetch) {
  return new AgentPassportClient({
    baseUrl: 'https://api.test.com',
    appId: 'test-app-id',
    appKey: 'ap_live_test_key',
    fetch: fetchImpl,
    timeoutMs: 5000,
    maxRetries: 2,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentPassportClient', () => {
  describe('constructor', () => {
    it('should throw if baseUrl is missing', () => {
      expect(
        () =>
          new AgentPassportClient({
            baseUrl: '',
            appId: 'x',
            appKey: 'y',
          }),
      ).toThrow('baseUrl is required');
    });

    it('should throw if appId is missing', () => {
      expect(
        () =>
          new AgentPassportClient({
            baseUrl: 'https://api.test.com',
            appId: '',
            appKey: 'y',
          }),
      ).toThrow('appId is required');
    });

    it('should throw if appKey is missing', () => {
      expect(
        () =>
          new AgentPassportClient({
            baseUrl: 'https://api.test.com',
            appId: 'x',
            appKey: '',
          }),
      ).toThrow('appKey is required');
    });
  });

  describe('verify()', () => {
    it('should return valid result for a verified token', async () => {
      const body = {
        valid: true,
        agent: { id: 'agent-1', handle: 'test-agent' },
        scopes: ['read'],
        expiresAt: '2026-12-31T23:59:59Z',
        risk: { score: 5, recommendedAction: 'allow', reasons: [] },
      };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = createClient(fetch);

      const result = await client.verify('some.jwt.token');

      expect(result.valid).toBe(true);
      expect(result).toEqual(body);
      expect(fetch).toHaveBeenCalledOnce();

      // Verify correct URL and headers
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/tokens/verify');
      expect((init.headers as Record<string, string>)['X-App-Id']).toBe('test-app-id');
      expect((init.headers as Record<string, string>)['X-App-Key']).toBe('ap_live_test_key');
      expect(JSON.parse(init.body as string)).toEqual({ token: 'some.jwt.token' });
    });

    it('should return invalid result for a failed verification', async () => {
      const body = {
        valid: false,
        reason: 'invalid_token',
        risk: { score: 0, recommendedAction: 'allow', reasons: [] },
      };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = createClient(fetch);

      const result = await client.verify('bad.token');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_token');
    });
  });

  describe('introspect()', () => {
    it('should return introspection result', async () => {
      const body = {
        active: true,
        sub: 'agent-1',
        iss: 'agent-passport',
        handle: 'test-agent',
        scopes: [],
        iat: 1700000000,
        exp: 1700003600,
        jti: 'jti-1',
      };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = createClient(fetch);

      const result = await client.introspect('some.jwt.token');

      expect(result.active).toBe(true);
      expect(result.sub).toBe('agent-1');

      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/tokens/introspect');
    });
  });

  describe('revoke()', () => {
    it('should revoke a token', async () => {
      const body = { revoked: true, jti: 'jti-123', expiresAt: '2026-12-31T23:59:59Z' };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = createClient(fetch);

      const result = await client.revoke('some.jwt.token');

      expect(result.revoked).toBe(true);
      expect(result.jti).toBe('jti-123');

      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/tokens/revoke');
    });
  });

  describe('error handling', () => {
    it('should throw PassportAuthError on 401', async () => {
      const fetch = mockFetch([
        { status: 401, body: { error: 'UNAUTHORIZED', reason: 'Invalid app key' } },
      ]);
      const client = createClient(fetch);

      await expect(client.verify('token')).rejects.toThrow(PassportAuthError);
      await expect(client.verify('token')).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        statusCode: 401,
      });
    });

    it('should throw PassportAuthError on 403', async () => {
      const fetch = mockFetch([
        { status: 403, body: { error: 'FORBIDDEN', reason: 'App suspended' } },
      ]);
      const client = createClient(fetch);

      await expect(client.verify('token')).rejects.toThrow(PassportAuthError);
    });

    it('should throw PassportValidationError on 400', async () => {
      const fetch = mockFetch([
        { status: 400, body: { error: 'VALIDATION_ERROR', reason: 'Token required' } },
      ]);
      const client = createClient(fetch);

      await expect(client.verify('token')).rejects.toThrow(PassportValidationError);
    });

    it('should throw PassportRateLimitError on 429 with Retry-After', async () => {
      const fetch = mockFetch([
        {
          status: 429,
          body: { error: 'RATE_LIMITED', reason: 'Too many requests' },
          headers: { 'Retry-After': '30' },
        },
        {
          status: 429,
          body: { error: 'RATE_LIMITED', reason: 'Too many requests' },
          headers: { 'Retry-After': '30' },
        },
        {
          status: 429,
          body: { error: 'RATE_LIMITED', reason: 'Too many requests' },
          headers: { 'Retry-After': '30' },
        },
      ]);
      const client = new AgentPassportClient({
        baseUrl: 'https://api.test.com',
        appId: 'x',
        appKey: 'y',
        fetch,
        maxRetries: 0, // no retries for speed
      });

      await expect(client.verify('token')).rejects.toThrow(PassportRateLimitError);
      await expect(client.verify('token')).rejects.toMatchObject({
        retryAfter: 30,
        statusCode: 429,
      });
    });

    it('should throw PassportNetworkError on fetch failure', async () => {
      const fetch = vi.fn(async () => {
        throw new TypeError('fetch failed');
      }) as unknown as typeof globalThis.fetch;
      const client = createClient(fetch);

      await expect(client.verify('token')).rejects.toThrow(PassportNetworkError);
    });

    it('should throw PassportError on unexpected status code (e.g. 500)', async () => {
      const fetch = mockFetch([
        { status: 500, body: { error: 'INTERNAL_ERROR', reason: 'Something broke' } },
      ]);
      const client = createClient(fetch);

      const err = await client.verify('token').catch((e: Error) => e);
      expect(err).toBeInstanceOf(PassportError);
      expect((err as PassportError).statusCode).toBe(500);
      expect((err as PassportError).code).toBe('INTERNAL_ERROR');
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 and succeed', async () => {
      const fetch = mockFetch([
        {
          status: 429,
          body: { error: 'RATE_LIMITED' },
          headers: { 'Retry-After': '0' },
        },
        {
          status: 200,
          body: { valid: true, agent: { id: 'agent-1', handle: 'a' }, risk: { score: 0, recommendedAction: 'allow', reasons: [] } },
        },
      ]);
      const client = new AgentPassportClient({
        baseUrl: 'https://api.test.com',
        appId: 'x',
        appKey: 'y',
        fetch,
        maxRetries: 3,
      });

      const result = await client.verify('token');

      expect(result.valid).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should give up after maxRetries on persistent 429', async () => {
      const fetch = mockFetch([
        { status: 429, body: { error: 'RATE_LIMITED' }, headers: { 'Retry-After': '0' } },
        { status: 429, body: { error: 'RATE_LIMITED' }, headers: { 'Retry-After': '0' } },
        { status: 429, body: { error: 'RATE_LIMITED' }, headers: { 'Retry-After': '0' } },
      ]);
      const client = new AgentPassportClient({
        baseUrl: 'https://api.test.com',
        appId: 'x',
        appKey: 'y',
        fetch,
        maxRetries: 1,
      });

      await expect(client.verify('token')).rejects.toThrow(PassportRateLimitError);
      // 1 original + 1 retry = 2 calls
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-429 errors', async () => {
      const fetch = mockFetch([
        { status: 401, body: { error: 'UNAUTHORIZED' } },
      ]);
      const client = createClient(fetch);

      await expect(client.verify('token')).rejects.toThrow(PassportAuthError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout', () => {
    it('should throw PassportNetworkError when request exceeds timeoutMs', async () => {
      // Create a fetch that respects the AbortSignal (like real fetch does)
      const fetch = vi.fn(((_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
              return;
            }
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
          // intentionally never resolves otherwise — simulates a hanging request
        });
      }) as unknown as typeof globalThis.fetch);

      const client = new AgentPassportClient({
        baseUrl: 'https://api.test.com',
        appId: 'x',
        appKey: 'y',
        fetch,
        timeoutMs: 50, // very short timeout
        maxRetries: 0,
      });

      const err = await client.verify('token').catch((e: Error) => e);
      expect(err).toBeInstanceOf(PassportNetworkError);
      expect(err.message).toContain('timed out');
    }, 5000); // test-level timeout
  });
});
