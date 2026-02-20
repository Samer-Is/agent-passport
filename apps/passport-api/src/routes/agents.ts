import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { 
  registerAgentRequestSchema, 
  identityTokenRequestSchema,
  addKeyRequestSchema,
} from '@agent-passport/shared';
import { 
  registerAgent, 
  issueChallenge, 
  issueIdentityToken,
  addAgentKey,
  revokeAgentKey,
  verifyIdentityToken,
} from '../services/agent.js';
import { AppError, ErrorCode } from '../errors/app-error.js';
import { rateLimitChallenge, rateLimitIdentityToken } from '../middleware/rate-limit.js';

// Helper to get client IP
function getClientIp(request: FastifyRequest): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip;
}

// Helper to extract Bearer token
function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice(7);
}

export const agentRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // POST /v1/agents/register - Register a new agent
  // =========================================================================
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerAgentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request body',
        { issues: parsed.error.issues }
      );
    }

    const { handle, publicKeyB64 } = parsed.data;
    const ip = getClientIp(request);

    const result = await registerAgent({ handle, publicKeyB64, ip });

    return reply.status(201).send(result);
  });

  // =========================================================================
  // POST /v1/agents/:agentId/challenge - Request authentication challenge
  // =========================================================================
  fastify.post(
    '/:agentId/challenge',
    { preHandler: rateLimitChallenge },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { agentId } = request.params as { agentId: string };
      const ip = getClientIp(request);

      const result = await issueChallenge({ agentId, ip });

      return reply.status(200).send({
        challengeId: result.challengeId,
        nonce: result.nonce,
        expiresAt: result.expiresAt.toISOString(),
      });
    }
  );

  // =========================================================================
  // POST /v1/agents/:agentId/identity-token - Exchange signed challenge for token
  // =========================================================================
  fastify.post(
    '/:agentId/identity-token',
    { preHandler: rateLimitIdentityToken },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { agentId } = request.params as { agentId: string };
      
      const parsed = identityTokenRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw AppError.badRequest(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request body',
          { issues: parsed.error.issues }
        );
      }

      const { challengeId, signatureB64, scopes } = parsed.data;
      const ip = getClientIp(request);

      const result = await issueIdentityToken({
        agentId,
        challengeId,
        signatureB64,
        scopes,
        ip,
      });

      return reply.status(200).send({
        token: result.token,
        expiresAt: result.expiresAt.toISOString(),
      });
    }
  );

  // =========================================================================
  // POST /v1/agents/:agentId/keys - Add a new key (requires auth)
  // =========================================================================
  fastify.post('/:agentId/keys', async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };
    
    // Verify token
    const token = extractBearerToken(request);
    if (!token) {
      throw AppError.unauthorized(ErrorCode.UNAUTHORIZED, 'Missing authorization token');
    }

    const tokenResult = await verifyIdentityToken(token);
    if (!tokenResult.valid) {
      throw AppError.unauthorized(ErrorCode.INVALID_TOKEN, `Invalid token: ${tokenResult.reason}`);
    }

    // Verify token belongs to this agent
    if (tokenResult.payload.sub !== agentId) {
      throw AppError.forbidden(ErrorCode.FORBIDDEN, 'Token does not belong to this agent');
    }

    // Parse body
    const parsed = addKeyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request body',
        { issues: parsed.error.issues }
      );
    }

    const { publicKeyB64 } = parsed.data;
    const ip = getClientIp(request);

    const result = await addAgentKey({ agentId, publicKeyB64, ip });

    return reply.status(201).send(result);
  });

  // =========================================================================
  // POST /v1/agents/:agentId/keys/:keyId/revoke - Revoke a key (requires auth)
  // =========================================================================
  fastify.post('/:agentId/keys/:keyId/revoke', async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId, keyId } = request.params as { agentId: string; keyId: string };
    
    // Verify token
    const token = extractBearerToken(request);
    if (!token) {
      throw AppError.unauthorized(ErrorCode.UNAUTHORIZED, 'Missing authorization token');
    }

    const tokenResult = await verifyIdentityToken(token);
    if (!tokenResult.valid) {
      throw AppError.unauthorized(ErrorCode.INVALID_TOKEN, `Invalid token: ${tokenResult.reason}`);
    }

    // Verify token belongs to this agent
    if (tokenResult.payload.sub !== agentId) {
      throw AppError.forbidden(ErrorCode.FORBIDDEN, 'Token does not belong to this agent');
    }

    const ip = getClientIp(request);

    await revokeAgentKey({ agentId, keyId, ip });

    return reply.status(200).send({ ok: true });
  });
};
