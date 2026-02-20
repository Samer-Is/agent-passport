/**
 * Rate Limiting Middleware for Fastify
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  rateLimiters,
  createRateLimitError,
  RateLimitResult,
} from '../services/rate-limiter.js';
import { recordRateLimitHit } from '../services/risk-engine.js';

/**
 * Get client IP from request (considering proxies)
 */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return request.ip || '127.0.0.1';
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(reply: FastifyReply, result: RateLimitResult): void {
  reply.header('X-RateLimit-Limit', result.limit.toString());
  reply.header('X-RateLimit-Remaining', result.remaining.toString());
  reply.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());
  
  if (!result.allowed && result.retryAfterSeconds) {
    reply.header('Retry-After', result.retryAfterSeconds.toString());
  }
}

/**
 * Rate limit middleware for challenge endpoint
 */
export async function rateLimitChallenge(
  request: FastifyRequest<{ Params: { agentId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const agentId = request.params.agentId;
  const ip = getClientIp(request);

  // Check both limits
  const [agentResult, ipResult] = await Promise.all([
    rateLimiters.challenge.perAgent(agentId),
    rateLimiters.challenge.perIp(ip),
  ]);

  // Use the most restrictive result
  const result = !agentResult.allowed ? agentResult : 
                 !ipResult.allowed ? ipResult : agentResult;

  addRateLimitHeaders(reply, result);

  if (!result.allowed) {
    // Record rate limit hit for risk scoring
    await recordRateLimitHit(agentId);
    
    return reply.status(429).send(createRateLimitError(result));
  }
}

/**
 * Rate limit middleware for identity-token endpoint
 */
export async function rateLimitIdentityToken(
  request: FastifyRequest<{ Params: { agentId: string } }>,
  reply: FastifyReply
): Promise<void> {
  const agentId = request.params.agentId;
  const ip = getClientIp(request);

  const [agentResult, ipResult] = await Promise.all([
    rateLimiters.identityToken.perAgent(agentId),
    rateLimiters.identityToken.perIp(ip),
  ]);

  const result = !agentResult.allowed ? agentResult : 
                 !ipResult.allowed ? ipResult : agentResult;

  addRateLimitHeaders(reply, result);

  if (!result.allowed) {
    await recordRateLimitHit(agentId);
    return reply.status(429).send(createRateLimitError(result));
  }
}

/**
 * Rate limit middleware for verify-identity endpoint
 */
export async function rateLimitVerifyIdentity(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const ip = getClientIp(request);
  
  // App ID is extracted from the authenticated app context
  const appId = (request as FastifyRequest & { appId?: string }).appId;
  
  if (!appId) {
    // No app authenticated yet, just check IP limit
    const ipResult = await rateLimiters.verifyIdentity.perIp(ip);
    addRateLimitHeaders(reply, ipResult);
    
    if (!ipResult.allowed) {
      return reply.status(429).send(createRateLimitError(ipResult));
    }
    return;
  }

  const [appResult, ipResult] = await Promise.all([
    rateLimiters.verifyIdentity.perApp(appId),
    rateLimiters.verifyIdentity.perIp(ip),
  ]);

  const result = !appResult.allowed ? appResult : 
                 !ipResult.allowed ? ipResult : appResult;

  addRateLimitHeaders(reply, result);

  if (!result.allowed) {
    return reply.status(429).send(createRateLimitError(result));
  }
}

/**
 * Generic rate limit middleware factory
 */
export function createRateLimitMiddleware(
  getIdentifier: (request: FastifyRequest) => string,
  config: { limit: number; windowSeconds: number; keyPrefix: string }
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { checkRateLimit, createRateLimitError } = await import('../services/rate-limiter.js');
    
    const identifier = getIdentifier(request);
    const result = await checkRateLimit(identifier, config);

    addRateLimitHeaders(reply, result);

    if (!result.allowed) {
      return reply.status(429).send(createRateLimitError(result));
    }
  };
}
