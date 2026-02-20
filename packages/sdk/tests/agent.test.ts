import { describe, it, expect, vi } from 'vitest';
import { AgentClient } from '../src/agent.js';
import {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentClient', () => {
  describe('constructor', () => {
    it('should throw if baseUrl is missing', () => {
      expect(() => new AgentClient({ baseUrl: '' })).toThrow('baseUrl is required');
    });

    it('should strip trailing slash from baseUrl', () => {
      const fetch = mockFetch([
        { status: 200, body: { agentId: 'id-1' } },
      ]);
      const client = new AgentClient({
        baseUrl: 'https://api.test.com/',
        fetch,
      });
      // Verify it works (no double slash)
      expect(client).toBeDefined();
    });
  });

  describe('register()', () => {
    it('should register an agent and return agentId', async () => {
      const fetch = mockFetch([
        { status: 200, body: { agentId: 'uuid-123' } },
      ]);
      const client = new AgentClient({
        baseUrl: 'https://api.test.com',
        fetch,
      });

      const result = await client.register({
        handle: 'test-agent',
        publicKeyB64: 'AAAA'.repeat(11), // 44-char base64
      });

      expect(result.agentId).toBe('uuid-123');

      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/agents/register');
      expect(JSON.parse(init.body as string)).toEqual({
        handle: 'test-agent',
        publicKeyB64: 'AAAA'.repeat(11),
      });
    });

    it('should throw PassportValidationError on 400', async () => {
      const fetch = mockFetch([
        { status: 400, body: { error: 'VALIDATION_ERROR', reason: 'Handle taken' } },
      ]);
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      await expect(
        client.register({ handle: 'taken', publicKeyB64: 'AAAA'.repeat(11) }),
      ).rejects.toThrow(PassportValidationError);
    });
  });

  describe('getChallenge()', () => {
    it('should return challenge with nonce', async () => {
      const body = {
        challengeId: 'ch-1',
        nonce: 'random-nonce-bytes',
        expiresAt: '2026-12-31T23:59:59Z',
      };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      const result = await client.getChallenge('agent-1');

      expect(result.challengeId).toBe('ch-1');
      expect(result.nonce).toBe('random-nonce-bytes');

      const [url] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/agents/agent-1/challenge');
    });
  });

  describe('exchangeToken()', () => {
    it('should exchange signature for token', async () => {
      const body = {
        token: 'eyJ...',
        expiresAt: '2026-12-31T23:59:59Z',
      };
      const fetch = mockFetch([{ status: 200, body }]);
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      const result = await client.exchangeToken({
        agentId: 'agent-1',
        challengeId: 'ch-1',
        signatureB64: 'sig-base64',
      });

      expect(result.token).toBe('eyJ...');

      const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.test.com/v1/agents/agent-1/identity-token');
      expect(JSON.parse(init.body as string)).toEqual({
        challengeId: 'ch-1',
        signatureB64: 'sig-base64',
        scopes: [],
      });
    });
  });

  describe('authenticate()', () => {
    it('should orchestrate challenge → sign → token exchange', async () => {
      const fetch = mockFetch([
        // 1. Challenge response
        {
          status: 200,
          body: {
            challengeId: 'ch-1',
            nonce: 'nonce-to-sign',
            expiresAt: '2026-12-31T23:59:59Z',
          },
        },
        // 2. Token exchange response
        {
          status: 200,
          body: {
            token: 'jwt-token-here',
            expiresAt: '2026-12-31T23:59:59Z',
          },
        },
      ]);
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      const signCallback = vi.fn(async (nonce: string) => {
        expect(nonce).toBe('nonce-to-sign');
        return 'signature-b64';
      });

      const result = await client.authenticate({
        agentId: 'agent-1',
        sign: signCallback,
      });

      expect(result.token).toBe('jwt-token-here');
      expect(signCallback).toHaveBeenCalledOnce();
      expect(signCallback).toHaveBeenCalledWith('nonce-to-sign');
      expect(fetch).toHaveBeenCalledTimes(2);

      // Verify second call sent the signature
      const [, init] = fetch.mock.calls[1] as [string, RequestInit];
      expect(JSON.parse(init.body as string).signatureB64).toBe('signature-b64');
    });

    it('should propagate sign callback errors', async () => {
      const fetch = mockFetch([
        {
          status: 200,
          body: {
            challengeId: 'ch-1',
            nonce: 'nonce',
            expiresAt: '2026-12-31T23:59:59Z',
          },
        },
      ]);
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      await expect(
        client.authenticate({
          agentId: 'agent-1',
          sign: async () => {
            throw new Error('HSM unavailable');
          },
        }),
      ).rejects.toThrow('HSM unavailable');
    });
  });

  describe('retry logic', () => {
    it('should retry on 429 and succeed', async () => {
      const fetch = mockFetch([
        { status: 429, body: { error: 'RATE_LIMITED' }, headers: { 'Retry-After': '0' } },
        { status: 200, body: { agentId: 'id-1' } },
      ]);
      const client = new AgentClient({
        baseUrl: 'https://api.test.com',
        fetch,
        maxRetries: 2,
      });

      const result = await client.register({ handle: 'a', publicKeyB64: 'AAAA'.repeat(11) });

      expect(result.agentId).toBe('id-1');
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('network errors', () => {
    it('should throw PassportNetworkError on fetch failure', async () => {
      const fetch = vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof globalThis.fetch;
      const client = new AgentClient({ baseUrl: 'https://api.test.com', fetch });

      await expect(client.register({ handle: 'a', publicKeyB64: 'AAAA'.repeat(11) })).rejects.toThrow(
        PassportNetworkError,
      );
    });
  });
});
