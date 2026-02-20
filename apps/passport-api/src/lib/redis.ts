import Redis from 'ioredis';
import { config } from '../config/index.js';

// Prevent multiple instances in development
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    console.error('Redis error:', err);
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected');
  });

  return redis;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Check if Redis is available and connected
 */
export function isRedisAvailable(): boolean {
  return redis.status === 'ready' || redis.status === 'connect';
}

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (error) {
    // ioredis may already be connected
    if ((error as Error).message?.includes('already')) {
      return;
    }
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log('Redis disconnected');
}

// ============================================================================
// Redis Key Prefixes
// ============================================================================

export const RedisKeys = {
  // Rate limiting
  rateLimit: (type: string, id: string) => `rl:${type}:${id}`,
  
  // Risk scoring counters
  invalidAttempts: (agentId: string) => `risk:invalid:${agentId}`,
  rateLimitHits: (agentId: string) => `risk:ratelimit:${agentId}`,
  burstActivity: (agentId: string) => `risk:burst:${agentId}`,
  
  // Risk state cache lock
  riskStateLock: (agentId: string) => `lock:risk:${agentId}`,
  
  // Challenge nonce (for additional validation)
  challengeNonce: (challengeId: string) => `challenge:${challengeId}`,
  
  // Token revocation blocklist
  revoked: (jti: string) => `revoked:${jti}`,
} as const;

// ============================================================================
// Redis Utilities
// ============================================================================

/**
 * Increment a counter with TTL
 */
export async function incrementCounter(
  key: string,
  ttlSeconds: number
): Promise<number> {
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, ttlSeconds);
  const results = await multi.exec();
  return (results?.[0]?.[1] as number) ?? 0;
}

/**
 * Get counter value
 */
export async function getCounter(key: string): Promise<number> {
  const value = await redis.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Acquire a lock with TTL (for distributed locking)
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

/**
 * Release a lock
 */
export async function releaseLock(key: string): Promise<void> {
  await redis.del(key);
}
