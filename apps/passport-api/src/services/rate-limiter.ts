/**
 * Rate Limiter - Redis-backed rate limiting using sliding window
 * 
 * Rate limits per endpoint:
 * - /challenge: 60/min per agent, 120/min per IP
 * - /identity-token: 30/min per agent, 60/min per IP
 * - /verify-identity: 600/min per app, 120/min per IP
 */

import { redis } from '../lib/redis.js';

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Key prefix for Redis */
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterSeconds?: number;
}

/**
 * Check and increment rate limit using sliding window algorithm
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  // Use a transaction to atomically check and increment
  const multi = redis.multi();
  
  // Remove old entries outside the window
  multi.zremrangebyscore(key, 0, windowStart);
  
  // Count current entries in window
  multi.zcard(key);
  
  // Add current request with timestamp as score
  multi.zadd(key, now, `${now}:${Math.random()}`);
  
  // Set expiry on the key
  multi.expire(key, config.windowSeconds + 1);

  const results = await multi.exec();
  
  // Get the count before adding the current request
  const currentCount = (results?.[1]?.[1] as number) || 0;
  
  const resetAt = new Date((now + config.windowSeconds) * 1000);
  const remaining = Math.max(0, config.limit - currentCount - 1);
  
  if (currentCount >= config.limit) {
    // Over limit - calculate retry after
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestTimestamp = oldestEntry?.[1] ? parseInt(oldestEntry[1], 10) : now;
    const retryAfterSeconds = Math.max(1, oldestTimestamp + config.windowSeconds - now);
    
    return {
      allowed: false,
      remaining: 0,
      limit: config.limit,
      resetAt,
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining,
    limit: config.limit,
    resetAt,
  };
}

/**
 * Increment a counter for tracking rate limit hits (for risk scoring)
 */
export async function incrementRateLimitHits(
  identifier: string,
  windowSeconds: number
): Promise<void> {
  const key = `ratelimit:hits:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  
  await redis.multi()
    .zadd(key, now, `${now}:${Math.random()}`)
    .expire(key, windowSeconds + 1)
    .exec();
}

/**
 * Get rate limit hit count for risk scoring
 */
export async function getRateLimitHits(
  identifier: string,
  windowSeconds: number
): Promise<number> {
  const key = `ratelimit:hits:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  // Clean up old entries and count
  await redis.zremrangebyscore(key, 0, windowStart);
  return redis.zcard(key);
}

// Pre-configured rate limiters for each endpoint

export const rateLimiters = {
  challenge: {
    perAgent: (agentId: string) => checkRateLimit(
      `agent:${agentId}`,
      { limit: 60, windowSeconds: 60, keyPrefix: 'challenge:agent' }
    ),
    perIp: (ip: string) => checkRateLimit(
      `ip:${ip}`,
      { limit: 120, windowSeconds: 60, keyPrefix: 'challenge:ip' }
    ),
  },
  
  identityToken: {
    perAgent: (agentId: string) => checkRateLimit(
      `agent:${agentId}`,
      { limit: 30, windowSeconds: 60, keyPrefix: 'token:agent' }
    ),
    perIp: (ip: string) => checkRateLimit(
      `ip:${ip}`,
      { limit: 60, windowSeconds: 60, keyPrefix: 'token:ip' }
    ),
  },
  
  verifyIdentity: {
    perApp: (appId: string) => checkRateLimit(
      `app:${appId}`,
      { limit: 600, windowSeconds: 60, keyPrefix: 'verify:app' }
    ),
    perIp: (ip: string) => checkRateLimit(
      `ip:${ip}`,
      { limit: 120, windowSeconds: 60, keyPrefix: 'verify:ip' }
    ),
  },
};

/**
 * Create rate limit error response
 */
export function createRateLimitError(result: RateLimitResult) {
  return {
    error: 'rate_limited',
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
    retryAfter: result.retryAfterSeconds,
    resetAt: result.resetAt.toISOString(),
  };
}
