// ============================================================================
// Agent Passport SDK — AgentPassportClient (for apps verifying agents)
// ============================================================================

import {
  PassportError,
  PassportNetworkError,
  PassportAuthError,
  PassportRateLimitError,
  PassportValidationError,
} from './errors.js';
import type {
  AgentPassportClientOptions,
  VerifyResult,
  IntrospectResult,
  RevokeResult,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

/**
 * Client for **apps** that want to verify agent identity tokens.
 *
 * @example
 * ```ts
 * import { AgentPassportClient } from '@zerobase-labs/passport-sdk';
 *
 * const passport = new AgentPassportClient({
 *   baseUrl: 'https://passport-api.onrender.com',
 *   appId: 'your-app-id',
 *   appKey: 'ap_live_...',
 * });
 *
 * const result = await passport.verify(token);
 * if (result.valid && result.risk?.action === 'allow') {
 *   // Agent is who they say they are ✓
 * }
 * ```
 */
export class AgentPassportClient {
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly appKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: AgentPassportClientOptions) {
    if (!options.baseUrl) throw new Error('baseUrl is required');
    if (!options.appId) throw new Error('appId is required');
    if (!options.appKey) throw new Error('appKey is required');

    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.appId = options.appId;
    this.appKey = options.appKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Verify an agent's identity token.
   *
   * @param token - The JWT identity token presented by the agent
   * @returns Verification result including agent info and risk assessment
   *
   * @example
   * ```ts
   * const result = await passport.verify(token);
   * if (result.valid) {
   *   console.log(`Agent ${result.handle} verified, risk: ${result.risk?.score}`);
   * }
   * ```
   */
  async verify(token: string): Promise<VerifyResult> {
    const raw = await this.requestWithRetry<VerifyResult>('POST', '/v1/tokens/verify', {
      token,
    });

    // The API returns `recommendedAction`; also expose it as `action` for convenience
    if (raw.risk) {
      const ra = raw.risk.recommendedAction ?? raw.risk.action;
      (raw.risk as { action: string; recommendedAction: string }).action = ra;
      (raw.risk as { action: string; recommendedAction: string }).recommendedAction = ra;
    }

    return raw;
  }

  /**
   * Introspect an agent's identity token (RFC 7662).
   *
   * @param token - The JWT identity token to introspect
   * @returns Token introspection result
   */
  async introspect(token: string): Promise<IntrospectResult> {
    return this.requestWithRetry<IntrospectResult>(
      'POST',
      '/v1/tokens/introspect',
      { token },
    );
  }

  /**
   * Revoke an agent's identity token before it expires.
   *
   * @param token - The JWT identity token to revoke
   * @returns Revocation result with the token's JTI
   */
  async revoke(token: string): Promise<RevokeResult> {
    return this.requestWithRetry<RevokeResult>('POST', '/v1/tokens/revoke', {
      token,
    });
  }

  // =========================================================================
  // Internal HTTP
  // =========================================================================

  private async requestWithRetry<T>(
    method: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.request<T>(method, path, body);
      } catch (err) {
        lastError = err as Error;

        // Only retry on 429 (rate limit) responses
        if (err instanceof PassportRateLimitError && attempt < this.maxRetries) {
          const backoffMs = err.retryAfter
            ? err.retryAfter * 1_000
            : BASE_BACKOFF_MS * Math.pow(2, attempt);
          await sleep(backoffMs);
          continue;
        }

        throw err;
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error('Request failed after retries');
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-App-Id': this.appId,
          'X-App-Key': this.appKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Parse error body
      let errorBody: { error?: string; reason?: string; details?: Record<string, unknown>; request_id?: string } = {};
      try {
        errorBody = (await response.json()) as typeof errorBody;
      } catch {
        // Non-JSON error response — use status text
      }

      const code = errorBody.error ?? `HTTP_${response.status}`;
      const message = errorBody.reason ?? errorBody.error ?? response.statusText;
      const requestId = errorBody.request_id;

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After')) || 1;
        throw new PassportRateLimitError(message, retryAfter, { requestId });
      }

      if (response.status === 401 || response.status === 403) {
        throw new PassportAuthError(code, message, response.status, {
          requestId,
          details: errorBody.details,
        });
      }

      if (response.status === 400) {
        throw new PassportValidationError(message, {
          requestId,
          details: errorBody.details,
        });
      }

      throw new PassportError(code, message, response.status, {
        requestId,
        details: errorBody.details,
      });
    } catch (err) {
      clearTimeout(timeoutId);

      // Re-throw SDK errors as-is
      if (err instanceof PassportError) {
        throw err;
      }

      // Wrap native errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new PassportNetworkError(
          `Request to ${url} timed out after ${this.timeoutMs}ms`,
          { cause: err },
        );
      }

      throw new PassportNetworkError(
        `Failed to connect to ${url}: ${(err as Error).message}`,
        { cause: err as Error },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
