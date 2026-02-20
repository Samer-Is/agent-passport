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

export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code: ErrorCodeType, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 400, details);
  }

  static unauthorized(code: ErrorCodeType, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 401, details);
  }

  static forbidden(code: ErrorCodeType, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 403, details);
  }

  static notFound(code: ErrorCodeType, message: string, details?: Record<string, unknown>): AppError {
    return new AppError(code, message, 404, details);
  }

  static tooManyRequests(message: string = 'Rate limit exceeded', details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429, details);
  }

  static internal(message: string = 'Internal server error', details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  }
}
