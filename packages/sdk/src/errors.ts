// ============================================================================
// Agent Passport SDK — Error Classes
// ============================================================================

/**
 * Base error class for all Agent Passport SDK errors.
 * Extends the native Error with HTTP status code and structured error info.
 */
export class PassportError extends Error {
  /** Machine-readable error code (e.g. INVALID_TOKEN, RATE_LIMITED) */
  public readonly code: string;
  /** HTTP status code returned by the API */
  public readonly statusCode: number;
  /** Seconds to wait before retrying (present on 429 responses) */
  public readonly retryAfter?: number;
  /** Server-assigned request ID for debugging */
  public readonly requestId?: string;
  /** Additional error details from the API */
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    options?: {
      retryAfter?: number;
      requestId?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'PassportError';
    this.code = code;
    this.statusCode = statusCode;
    this.retryAfter = options?.retryAfter;
    this.requestId = options?.requestId;
    this.details = options?.details;
  }
}

/**
 * Thrown when the SDK cannot reach the Agent Passport API
 * (DNS failure, connection refused, timeout, etc.)
 */
export class PassportNetworkError extends PassportError {
  constructor(message: string, options?: { cause?: Error }) {
    super('NETWORK_ERROR', message, 0, {});
    this.name = 'PassportNetworkError';
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}

/**
 * Thrown on 401 or 403 responses — invalid or missing credentials.
 */
export class PassportAuthError extends PassportError {
  constructor(
    code: string,
    message: string,
    statusCode: number,
    options?: { requestId?: string; details?: Record<string, unknown> },
  ) {
    super(code, message, statusCode, options);
    this.name = 'PassportAuthError';
  }
}

/**
 * Thrown on 429 responses — too many requests.
 * Check `retryAfter` for the number of seconds to wait.
 */
export class PassportRateLimitError extends PassportError {
  constructor(
    message: string,
    retryAfter: number,
    options?: { requestId?: string },
  ) {
    super('RATE_LIMITED', message, 429, {
      retryAfter,
      requestId: options?.requestId,
    });
    this.name = 'PassportRateLimitError';
  }
}

/**
 * Thrown on 400 responses — request validation failed.
 */
export class PassportValidationError extends PassportError {
  constructor(
    message: string,
    options?: {
      requestId?: string;
      details?: Record<string, unknown>;
    },
  ) {
    super('VALIDATION_ERROR', message, 400, options);
    this.name = 'PassportValidationError';
  }
}
