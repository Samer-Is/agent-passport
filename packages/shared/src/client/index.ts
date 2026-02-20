import type {
  RegisterAgentRequest,
  RegisterAgentResponse,
  ChallengeResponse,
  IdentityTokenRequest,
  IdentityTokenResponse,
  VerifyIdentityRequest,
  VerifyIdentityResponse,
  AddKeyRequest,
  AddKeyResponse,
  RevokeKeyResponse,
  ErrorResponse,
} from '../schemas/index.js';
import { Headers } from '../constants/index.js';

export interface PassportClientOptions {
  baseUrl: string;
  /** App key for verify-identity endpoint (optional, only for app verification) */
  appKey?: string;
  /** Custom fetch implementation (optional, for testing or different environments) */
  fetch?: typeof fetch;
}

export class PassportClient {
  private baseUrl: string;
  private appKey?: string;
  private fetchImpl: typeof fetch;

  constructor(options: PassportClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.appKey = options.appKey;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      token?: string;
    } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.token) {
      headers[Headers.AUTHORIZATION] = `Bearer ${options.token}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ErrorResponse;
      throw new PassportApiError(
        error.error.code,
        error.error.message,
        response.status,
        error.request_id,
        error.error.details
      );
    }

    return data as T;
  }

  // =========================================================================
  // Agent Endpoints
  // =========================================================================

  /**
   * Register a new agent with a handle and public key
   */
  async registerAgent(request: RegisterAgentRequest): Promise<RegisterAgentResponse> {
    return this.request<RegisterAgentResponse>('POST', '/v1/agents/register', {
      body: request,
    });
  }

  /**
   * Request a challenge for an agent to prove identity
   */
  async requestChallenge(agentId: string): Promise<ChallengeResponse> {
    return this.request<ChallengeResponse>('POST', `/v1/agents/${agentId}/challenge`);
  }

  /**
   * Exchange a signed challenge for an identity token
   */
  async getIdentityToken(
    agentId: string,
    request: IdentityTokenRequest
  ): Promise<IdentityTokenResponse> {
    return this.request<IdentityTokenResponse>(
      'POST',
      `/v1/agents/${agentId}/identity-token`,
      { body: request }
    );
  }

  /**
   * Add a new key for an agent (requires identity token)
   */
  async addKey(
    agentId: string,
    request: AddKeyRequest,
    token: string
  ): Promise<AddKeyResponse> {
    return this.request<AddKeyResponse>('POST', `/v1/agents/${agentId}/keys`, {
      body: request,
      token,
    });
  }

  /**
   * Revoke a key for an agent (requires identity token)
   */
  async revokeKey(
    agentId: string,
    keyId: string,
    token: string
  ): Promise<RevokeKeyResponse> {
    return this.request<RevokeKeyResponse>(
      'POST',
      `/v1/agents/${agentId}/keys/${keyId}/revoke`,
      { token }
    );
  }

  // =========================================================================
  // App Verification Endpoint
  // =========================================================================

  /**
   * Verify an agent identity token (requires app key)
   */
  async verifyIdentity(request: VerifyIdentityRequest): Promise<VerifyIdentityResponse> {
    if (!this.appKey) {
      throw new Error('App key is required to verify identity');
    }

    return this.request<VerifyIdentityResponse>('POST', '/v1/apps/verify-identity', {
      body: request,
      headers: {
        [Headers.APP_KEY]: this.appKey,
      },
    });
  }
}

export class PassportApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly requestId: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PassportApiError';
  }
}
