// ============================================================================
// Agent Passport SDK — TypeScript Types
// ============================================================================

// ---------------------------------------------------------------------------
// Common
// ---------------------------------------------------------------------------

export type RiskAction = 'allow' | 'throttle' | 'block';

export interface RiskAssessment {
  score: number;
  /** Short-hand action — `'allow'`, `'throttle'`, or `'block'` */
  action: RiskAction;
  /**
   * Same value as {@link action}. Preserved for compatibility with the raw
   * API JSON which returns `recommendedAction`.
   */
  recommendedAction: RiskAction;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Verification (App-side)
// ---------------------------------------------------------------------------

export interface VerifyResult {
  valid: boolean;
  /** Present when valid === true */
  agentId?: string;
  /** Present when valid === true */
  handle?: string;
  /** Present when valid === true */
  scopes?: string[];
  /** Present when valid === true */
  expiresAt?: string;
  /** Present when valid === false */
  reason?: string;
  /** Risk assessment (may be absent if risk engine unavailable) */
  risk?: RiskAssessment;
}

export interface IntrospectResult {
  active: boolean;
  sub?: string;
  iss?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  handle?: string;
  scopes?: string[];
  [key: string]: unknown;
}

export interface RevokeResult {
  revoked: boolean;
  jti: string;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Agent Authentication
// ---------------------------------------------------------------------------

export interface RegisterAgentParams {
  handle: string;
  publicKeyB64: string;
}

export interface RegisterAgentResult {
  agentId: string;
  /** Agent status (e.g. 'active', 'suspended'). May be omitted by minimal API responses. */
  status?: string;
}

export interface ChallengeResult {
  challengeId: string;
  nonce: string;
  expiresAt: string;
}

export interface AuthenticateParams {
  agentId: string;
  /**
   * Callback that signs the challenge nonce.
   * The SDK calls this with the raw nonce string; you must return the
   * Ed25519 signature as a base64-encoded string.
   *
   * **SECURITY**: Private keys never enter the SDK — signing stays in your code.
   */
  sign: (nonce: string) => Promise<string>;
}

export interface AuthenticateResult {
  token: string;
  expiresAt: string;
}

export interface ExchangeTokenParams {
  agentId: string;
  challengeId: string;
  signatureB64: string;
  scopes?: string[];
}

// ---------------------------------------------------------------------------
// Client Options
// ---------------------------------------------------------------------------

export interface AgentPassportClientOptions {
  /** Base URL of the Agent Passport API (e.g. https://agent-passport.onrender.com) */
  baseUrl: string;
  /** Your App ID (from the portal) */
  appId: string;
  /** Your App API key (starts with ap_live_) */
  appKey: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Maximum retries on 429 responses (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (default: globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}

export interface AgentClientOptions {
  /** Base URL of the Agent Passport API */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number;
  /** Maximum retries on 429 responses (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (default: globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}
