// ============================================================================
// HTTP Headers
// ============================================================================

export const Headers = {
  /** App API key for verify-identity endpoint */
  APP_KEY: 'X-App-Key',
  /** Portal internal API key for admin endpoints */
  PORTAL_INTERNAL_KEY: 'X-Portal-Internal-Key',
  /** Request ID for tracing */
  REQUEST_ID: 'X-Request-ID',
  /** Authorization header */
  AUTHORIZATION: 'Authorization',
} as const;

// ============================================================================
// JWT Claim Names
// ============================================================================

export const JwtClaims = {
  /** Issuer claim */
  ISSUER: 'iss',
  /** Subject (agent ID) */
  SUBJECT: 'sub',
  /** Agent handle */
  HANDLE: 'handle',
  /** Scopes granted */
  SCOPES: 'scopes',
  /** Issued at timestamp */
  ISSUED_AT: 'iat',
  /** Expiration timestamp */
  EXPIRES_AT: 'exp',
  /** JWT ID */
  JWT_ID: 'jti',
} as const;

export const JWT_ISSUER = 'agent-passport';

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCode = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Agent-specific
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_SUSPENDED: 'AGENT_SUSPENDED',
  HANDLE_TAKEN: 'HANDLE_TAKEN',
  INVALID_PUBLIC_KEY: 'INVALID_PUBLIC_KEY',

  // Challenge-specific
  CHALLENGE_NOT_FOUND: 'CHALLENGE_NOT_FOUND',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  CHALLENGE_ALREADY_USED: 'CHALLENGE_ALREADY_USED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',

  // Key-specific
  KEY_NOT_FOUND: 'KEY_NOT_FOUND',
  KEY_ALREADY_REVOKED: 'KEY_ALREADY_REVOKED',
  NO_ACTIVE_KEYS: 'NO_ACTIVE_KEYS',

  // Token-specific
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // App-specific
  APP_NOT_FOUND: 'APP_NOT_FOUND',
  APP_SUSPENDED: 'APP_SUSPENDED',
  INVALID_APP_KEY: 'INVALID_APP_KEY',
  APP_KEY_REVOKED: 'APP_KEY_REVOKED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// Risk Scoring
// ============================================================================

export const RiskThresholds = {
  /** Score below this = allow */
  ALLOW_MAX: 29,
  /** Score below this = throttle (above ALLOW_MAX) */
  THROTTLE_MAX: 59,
  /** Score at or above this = block */
  BLOCK_MIN: 60,
} as const;

export const RiskReasons = {
  AGENT_SUSPENDED: 'agent_suspended',
  NEW_AGENT: 'new_agent',
  HIGH_INVALID_RATE: 'high_invalid_rate',
  RATE_LIMITED_OFTEN: 'rate_limited_often',
  BURST_ACTIVITY: 'burst_activity',
} as const;

// ============================================================================
// Audit Event Types
// ============================================================================

export const AuditEventType = {
  AGENT_REGISTERED: 'agent_registered',
  CHALLENGE_ISSUED: 'challenge_issued',
  TOKEN_ISSUED: 'token_issued',
  TOKEN_ISSUE_FAILED: 'token_issue_failed',
  KEY_ADDED: 'key_added',
  KEY_REVOKED: 'key_revoked',
  AGENT_SUSPENDED: 'agent_suspended',
  AGENT_UNSUSPENDED: 'agent_unsuspended',
  APP_CREATED: 'app_created',
  APP_KEY_GENERATED: 'app_key_generated',
  APP_KEY_REVOKED: 'app_key_revoked',
  APP_SUSPENDED: 'app_suspended',
  APP_UNSUSPENDED: 'app_unsuspended',
  VERIFICATION_SUCCESS: 'verification_success',
  VERIFICATION_FAILED: 'verification_failed',
  TOKEN_REVOKED: 'token_revoked',
  HUMAN_VERIFICATION_LINKED: 'human_verification_linked',
  HUMAN_VERIFICATION_REVOKED: 'human_verification_revoked',
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

export const ActorType = {
  AGENT: 'agent',
  APP: 'app',
  SYSTEM: 'system',
  IP: 'ip',
} as const;

// ============================================================================
// Rate Limits (per minute)
// ============================================================================

export const RateLimits = {
  CHALLENGE: {
    PER_AGENT: 60,
    PER_IP: 120,
  },
  IDENTITY_TOKEN: {
    PER_AGENT: 30,
    PER_IP: 60,
  },
  VERIFY_IDENTITY: {
    PER_APP: 600,
    PER_IP: 120,
  },
} as const;

// ============================================================================
// TTLs (in seconds)
// ============================================================================

export const TTL = {
  /** Default token TTL: 60 minutes */
  TOKEN_DEFAULT_MINUTES: 60,
  /** Challenge TTL: 5 minutes */
  CHALLENGE_DEFAULT_MINUTES: 5,
  /** Risk state cache TTL: 5 minutes */
  RISK_STATE_CACHE_MINUTES: 5,
} as const;
