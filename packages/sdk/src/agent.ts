// ============================================================================
// Agent Passport SDK — AgentClient (for agents authenticating themselves)
// ============================================================================

import {
  PassportError,
  PassportNetworkError,
  PassportRateLimitError,
  PassportValidationError,
  PassportAuthError,
} from './errors.js';
import type {
  AgentClientOptions,
  RegisterAgentParams,
  RegisterAgentResult,
  ChallengeResult,
  AuthenticateParams,
  AuthenticateResult,
  ExchangeTokenParams,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1_000;

/**
 * Client for **AI agents** that want to authenticate with Agent Passport.
 *
 * **SECURITY**: Private keys never enter this SDK. The `authenticate()` method
 * takes a `sign` callback — your code does the signing and only the signature
 * is sent to the API.
 *
 * @example
 * ```ts
 * import { AgentClient } from '@zerobase-labs/passport-sdk';
 *
 * const agent = new AgentClient({
 *   baseUrl: 'https://passport-api.onrender.com',
 * });
 *
 * // Register a new agent
 * const { agentId } = await agent.register({
 *   handle: 'my-cool-agent',
 *   publicKeyB64: '...',
 * });
 *
 * // Authenticate (challenge → sign → token)
 * const { token, expiresAt } = await agent.authenticate({
 *   agentId,
 *   sign: async (nonce) => {
 *     // Sign with your private key — it never leaves your code
 *     return mySignFunction(nonce, privateKey);
 *   },
 * });
 * ```
 */
export class AgentClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: AgentClientOptions) {
    if (!options.baseUrl) throw new Error('baseUrl is required');

    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Register a new agent with Agent Passport.
   *
   * @param params - Agent handle and Ed25519 public key (base64)
   * @returns Object containing the new agent's ID
   */
  async register(params: RegisterAgentParams): Promise<RegisterAgentResult> {
    return this.requestWithRetry<RegisterAgentResult>(
      'POST',
      '/v1/agents/register',
      {
        handle: params.handle,
        publicKeyB64: params.publicKeyB64,
      },
    );
  }

  /**
   * Full authentication flow: request challenge → sign nonce → exchange for token.
   *
   * **SECURITY**: The `sign` callback keeps private keys out of the SDK.
   * You provide the signing logic; the SDK handles the protocol.
   *
   * @param params - Agent ID + async sign callback
   * @returns JWT identity token and its expiration time
   */
  async authenticate(params: AuthenticateParams): Promise<AuthenticateResult> {
    // Step 1: Request challenge
    const challenge = await this.getChallenge(params.agentId);

    // Step 2: Sign the nonce with the user-provided callback
    const signatureB64 = await params.sign(challenge.nonce);

    // Step 3: Exchange signature for token
    return this.exchangeToken({
      agentId: params.agentId,
      challengeId: challenge.challengeId,
      signatureB64,
    });
  }

  /**
   * Request a challenge nonce for a specific agent.
   *
   * @param agentId - The agent's UUID
   * @returns Challenge ID, nonce, and expiration time
   */
  async getChallenge(agentId: string): Promise<ChallengeResult> {
    return this.requestWithRetry<ChallengeResult>(
      'POST',
      `/v1/agents/${agentId}/challenge`,
    );
  }

  /**
   * Exchange a signed challenge for an identity token.
   *
   * @param params - Agent ID, challenge ID, and base64-encoded signature
   * @returns JWT identity token and its expiration time
   */
  async exchangeToken(params: ExchangeTokenParams): Promise<AuthenticateResult> {
    return this.requestWithRetry<AuthenticateResult>(
      'POST',
      `/v1/agents/${params.agentId}/identity-token`,
      {
        challengeId: params.challengeId,
        signatureB64: params.signatureB64,
        scopes: params.scopes ?? [],
      },
    );
  }

  // =========================================================================
  // Internal HTTP
  // =========================================================================

  private async requestWithRetry<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.request<T>(method, path, body);
      } catch (err) {
        lastError = err as Error;

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

    throw lastError ?? new Error('Request failed after retries');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };

      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      const response = await this.fetchImpl(url, init);

      clearTimeout(timeoutId);

      if (response.ok) {
        return (await response.json()) as T;
      }

      let errorBody: {
        error?: string;
        reason?: string;
        details?: Record<string, unknown>;
        request_id?: string;
      } = {};
      try {
        errorBody = (await response.json()) as typeof errorBody;
      } catch {
        // Non-JSON response
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

      if (err instanceof PassportError) {
        throw err;
      }

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
