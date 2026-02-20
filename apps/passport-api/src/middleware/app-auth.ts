/**
 * App Auth Middleware - authenticate apps using API keys
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { validateAppApiKey } from '../services/app.js';

// Extend FastifyRequest to include app info
declare module 'fastify' {
  interface FastifyRequest {
    app?: {
      id: string;
      name: string;
      allowedScopes: string[];
    };
    appKeyId?: string;
  }
}

/**
 * Middleware to authenticate app API keys
 * Supports:
 *   - Authorization: Bearer ap_live_xxx
 *   - X-App-Key: ap_live_xxx (SDK pattern, with optional X-App-Id)
 */
export async function appAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const xAppKey = request.headers['x-app-key'] as string | undefined;

  // Resolve API key from Authorization header or X-App-Key header
  let token: string | undefined;

  if (authHeader) {
    // Support both "Bearer <token>" and just "<token>"
    token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
  } else if (xAppKey) {
    token = xAppKey;
  }

  if (!token) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Missing Authorization header or X-App-Key header',
    });
  }

  if (!token.startsWith('ap_live_')) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Invalid API key format',
    });
  }

  try {
    const result = await validateAppApiKey(token);

    if (!result.valid || !result.app) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Invalid or revoked API key',
      });
    }

    // Attach app info to request
    request.app = {
      id: result.app.id,
      name: result.app.name,
      allowedScopes: result.app.allowedScopes,
    };
    request.appKeyId = result.keyId ?? undefined;
  } catch (error) {
    request.log.error({ err: error }, 'App authentication error');
    return reply.status(500).send({
      error: 'internal_error',
      message: 'Authentication failed',
    });
  }
}

/**
 * Optional app auth - doesn't fail if no auth provided
 */
export async function optionalAppAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const xAppKey = request.headers['x-app-key'] as string | undefined;

  let token: string | undefined;

  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
  } else if (xAppKey) {
    token = xAppKey;
  }

  if (!token || !token.startsWith('ap_live_')) {
    return; // No valid app key, continue without app context
  }

  try {
    const result = await validateAppApiKey(token);

    if (result.valid && result.app) {
      request.app = {
        id: result.app.id,
        name: result.app.name,
        allowedScopes: result.app.allowedScopes,
      };
      request.appKeyId = result.keyId ?? undefined;
    }
  } catch (error) {
    request.log.error({ err: error }, 'Optional app auth error');
    // Don't fail, just continue without app context
  }
}
