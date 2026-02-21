/**
 * Human Verification Routes
 *
 * POST /v1/agents/:agentId/human-verification  — Link human verification (requires agent auth)
 * GET  /v1/agents/:agentId/human-verification  — Get verification status (public)
 * DELETE /v1/agents/:agentId/human-verification/:provider — Revoke verification (requires agent auth)
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  linkHumanVerification,
  getHumanVerifications,
  revokeHumanVerification,
} from '../services/human-verification.js';
import { verifyIdentityToken } from '../services/agent.js';
import { AppError, ErrorCode } from '../errors/app-error.js';

// Request schemas
const linkHumanVerificationSchema = z.object({
  provider: z.string().min(1).max(50),
  providerId: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Helper to extract Bearer token
function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice(7);
}

// Helper to get client IP
function getClientIp(request: FastifyRequest): string | undefined {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip;
}

export const humanVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // POST /v1/agents/:agentId/human-verification
  // Link a human verification to an agent (requires agent identity token)
  // =========================================================================
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };

    // Require agent authentication
    const token = extractBearerToken(request);
    if (!token) {
      throw AppError.unauthorized(ErrorCode.UNAUTHORIZED, 'Missing authorization token');
    }

    const tokenResult = await verifyIdentityToken(token);
    if (!tokenResult.valid) {
      throw AppError.unauthorized(ErrorCode.INVALID_TOKEN, `Invalid token: ${tokenResult.reason}`);
    }

    if (tokenResult.payload.sub !== agentId) {
      throw AppError.forbidden(ErrorCode.FORBIDDEN, 'Token does not belong to this agent');
    }

    // Parse body
    const parsed = linkHumanVerificationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request body',
        { issues: parsed.error.issues },
      );
    }

    const { provider, providerId, displayName, expiresAt, metadata } = parsed.data;
    const ip = getClientIp(request);

    const result = await linkHumanVerification({
      agentId,
      provider,
      providerId,
      displayName,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      ip,
    });

    return reply.status(201).send(result);
  });

  // =========================================================================
  // GET /v1/agents/:agentId/human-verification
  // Get human verification status (public endpoint)
  // =========================================================================
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId } = request.params as { agentId: string };

    const result = await getHumanVerifications(agentId);

    return reply.status(200).send(result);
  });

  // =========================================================================
  // DELETE /v1/agents/:agentId/human-verification/:provider
  // Revoke a human verification (requires agent auth)
  // =========================================================================
  fastify.delete('/:provider', async (request: FastifyRequest, reply: FastifyReply) => {
    const { agentId, provider } = request.params as { agentId: string; provider: string };

    // Require agent authentication
    const token = extractBearerToken(request);
    if (!token) {
      throw AppError.unauthorized(ErrorCode.UNAUTHORIZED, 'Missing authorization token');
    }

    const tokenResult = await verifyIdentityToken(token);
    if (!tokenResult.valid) {
      throw AppError.unauthorized(ErrorCode.INVALID_TOKEN, `Invalid token: ${tokenResult.reason}`);
    }

    if (tokenResult.payload.sub !== agentId) {
      throw AppError.forbidden(ErrorCode.FORBIDDEN, 'Token does not belong to this agent');
    }

    const ip = getClientIp(request);

    await revokeHumanVerification(agentId, provider, ip);

    return reply.status(200).send({ ok: true });
  });
};
