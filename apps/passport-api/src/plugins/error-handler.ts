import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../errors/app-error.js';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  request_id: string;
}

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id;

  // Log the error
  request.log.error({
    err: error,
    requestId,
    url: request.url,
    method: request.method,
  });

  // Handle AppError (our custom errors)
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      request_id: requestId,
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const response: ErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          issues: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
      request_id: requestId,
    };
    reply.status(400).send(response);
    return;
  }

  // Handle Fastify errors (e.g., validation, not found)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const response: ErrorResponse = {
      error: {
        code: error.code || ErrorCode.INTERNAL_ERROR,
        message: error.message,
      },
      request_id: requestId,
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
    },
    request_id: requestId,
  };
  reply.status(500).send(response);
}
