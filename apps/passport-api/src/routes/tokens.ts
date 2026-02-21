/**
 * Token Routes - verify and introspect identity tokens
 * These endpoints are used by apps to validate agent tokens
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { verifyToken, introspectToken, getVerificationStats, revokeToken } from '../services/token.js';
import { appAuthMiddleware } from '../middleware/app-auth.js';
import { rateLimitVerifyIdentity, getClientIp } from '../middleware/rate-limit.js';

// Request schemas
const VerifyTokenSchema = z.object({
  token: z.string().min(1),
});

const IntrospectTokenSchema = z.object({
  token: z.string().min(1),
});

const RevokeTokenSchema = z.object({
  token: z.string().min(1),
});
// Note: Also available as RevokeTokenSchema from @zerobase-labs/passport-sdk shared schemas

export async function tokenRoutes(fastify: FastifyInstance) {
  // All token routes require app authentication
  fastify.addHook('preHandler', appAuthMiddleware);
  
  // Apply rate limiting to verify endpoint
  fastify.addHook('preHandler', rateLimitVerifyIdentity);

  /**
   * POST /tokens/verify - Verify an identity token
   * 
   * Used by apps to verify that a token is valid and get basic agent info.
   * This is the primary endpoint apps should use for authentication.
   */
  fastify.post('/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = VerifyTokenSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    const { token } = parseResult.data;
    const appId = request.app!.id;
    const ip = getClientIp(request);

    const result = await verifyToken(token, appId, ip);

    if (!result.valid) {
      return reply.status(200).send({
        valid: false,
        reason: result.reason,
        risk: result.risk,
      });
    }

    return reply.send({
      valid: true,
      agent: {
        id: result.agentId,
        handle: result.handle,
      },
      scopes: result.scopes,
      expiresAt: result.expiresAt?.toISOString(),
      risk: result.risk,
      humanVerification: result.humanVerification,
    });
  });

  /**
   * POST /tokens/introspect - Introspect an identity token
   * 
   * Returns detailed information about a token per RFC 7662.
   * Useful for debugging and advanced use cases.
   */
  fastify.post('/introspect', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = IntrospectTokenSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    const { token } = parseResult.data;
    const appId = request.app!.id;

    const result = await introspectToken(token, appId);

    return reply.send(result);
  });

  /**
   * POST /tokens/revoke - Revoke an identity token
   * 
   * Adds the token's JTI to a Redis blocklist so it will be rejected
   * on future verify calls. The blocklist entry auto-expires when the
   * token would have expired anyway.
   */
  fastify.post('/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = RevokeTokenSchema.safeParse(request.body);
    
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    const { token } = parseResult.data;
    const appId = request.app!.id;
    const ip = getClientIp(request);

    const result = await revokeToken(token, appId, ip);

    if (!result.revoked) {
      return reply.status(422).send({
        error: 'revocation_failed',
        reason: result.reason,
      });
    }

    return reply.send({
      revoked: true,
      jti: result.jti,
      expiresAt: result.expiresAt,
    });
  });

  /**
   * GET /tokens/stats - Get verification statistics for the app
   * 
   * Returns aggregate stats about token verifications.
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const appId = request.app!.id;
    
    // Get stats for last 24 hours by default
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stats = await getVerificationStats(appId, since);

    return reply.send({
      period: '24h',
      stats,
    });
  });
}
