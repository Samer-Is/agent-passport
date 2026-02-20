/**
 * Risk Engine - Explainable, rule-based risk scoring
 * 
 * Signals (MVP):
 * - agent status (DB)
 * - agent age in days (DB)
 * - recent invalid rate (Redis counters over 24h)
 * - rate limit hits over 1h (Redis)
 * - burst activity in last 10m (Redis)
 * 
 * Score: 0-100 (clamped)
 * - 0-29: allow
 * - 30-59: throttle
 * - 60-100: block
 */

import { prisma } from '../lib/prisma.js';
import { redis, isRedisAvailable } from '../lib/redis.js';

export type RiskAction = 'allow' | 'throttle' | 'block';

export interface RiskAssessment {
  score: number;
  recommendedAction: RiskAction;
  reasons: string[];
}

export interface RiskSignals {
  agentId: string;
  agentStatus: 'active' | 'suspended';
  agentCreatedAt: Date;
}

// Redis key prefixes for risk signals
const REDIS_KEYS = {
  invalidAttempts: (agentId: string) => `risk:invalid:${agentId}`,
  rateLimitHits: (agentId: string) => `risk:ratelimit:${agentId}`,
  burstActivity: (agentId: string) => `risk:burst:${agentId}`,
};

// Time windows in seconds
const WINDOWS = {
  invalid24h: 24 * 60 * 60,
  rateLimit1h: 60 * 60,
  burst10m: 10 * 60,
};

// Thresholds
const THRESHOLDS = {
  invalidRate: 0.2, // 20% invalid rate triggers flag
  rateLimitHits: 10, // hits in 1h
  burstBaseline: 50, // requests in 10m
};

/**
 * Record an invalid token verification attempt for risk scoring
 * Fails silently if Redis is unavailable
 */
export async function recordInvalidAttempt(agentId: string): Promise<void> {
  if (!isRedisAvailable()) return;
  
  try {
    const key = REDIS_KEYS.invalidAttempts(agentId);
    const now = Math.floor(Date.now() / 1000);
    
    await redis.multi()
      .zadd(key, now, `${now}:invalid:${Math.random()}`)
      .expire(key, WINDOWS.invalid24h + 60)
      .exec();
  } catch (error) {
    console.error('Failed to record invalid attempt:', error);
  }
}

/**
 * Record a valid token verification for calculating invalid rate
 * Fails silently if Redis is unavailable
 */
export async function recordValidAttempt(agentId: string): Promise<void> {
  if (!isRedisAvailable()) return;
  
  try {
    const key = REDIS_KEYS.invalidAttempts(agentId);
    const now = Math.floor(Date.now() / 1000);
    
    // We store valid attempts with a different prefix to calculate rates
    await redis.multi()
      .zadd(key, now, `${now}:valid:${Math.random()}`)
      .expire(key, WINDOWS.invalid24h + 60)
      .exec();
  } catch (error) {
    console.error('Failed to record valid attempt:', error);
  }
}

/**
 * Record a rate limit hit for risk scoring
 * Fails silently if Redis is unavailable
 */
export async function recordRateLimitHit(agentId: string): Promise<void> {
  if (!isRedisAvailable()) return;
  
  try {
    const key = REDIS_KEYS.rateLimitHits(agentId);
    const now = Math.floor(Date.now() / 1000);
    
    await redis.multi()
      .zadd(key, now, `${now}:${Math.random()}`)
      .expire(key, WINDOWS.rateLimit1h + 60)
      .exec();
  } catch (error) {
    console.error('Failed to record rate limit hit:', error);
  }
}

/**
 * Record activity for burst detection
 * Fails silently if Redis is unavailable
 */
export async function recordActivity(agentId: string): Promise<void> {
  if (!isRedisAvailable()) return;
  
  try {
    const key = REDIS_KEYS.burstActivity(agentId);
    const now = Math.floor(Date.now() / 1000);
    
    await redis.multi()
      .zadd(key, now, `${now}:${Math.random()}`)
      .expire(key, WINDOWS.burst10m + 60)
      .exec();
  } catch (error) {
    console.error('Failed to record activity:', error);
  }
}

/**
 * Get the count of entries in a time window
 * Returns 0 if Redis is unavailable
 */
async function getWindowCount(key: string, windowSeconds: number): Promise<number> {
  if (!isRedisAvailable()) return 0;
  
  try {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;
    
    await redis.zremrangebyscore(key, 0, windowStart);
    return redis.zcard(key);
  } catch (error) {
    console.error('Failed to get window count:', error);
    return 0;
  }
}

/**
 * Get invalid rate over 24h
 * Returns 0 if Redis is unavailable
 */
async function getInvalidRate(agentId: string): Promise<number> {
  if (!isRedisAvailable()) return 0;
  
  try {
    const key = REDIS_KEYS.invalidAttempts(agentId);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - WINDOWS.invalid24h;
    
    // Get all entries and count valid vs invalid
    const entries = await redis.zrangebyscore(key, windowStart, now);
    
    if (entries.length === 0) return 0;
    
    const invalidCount = entries.filter(e => e.includes(':invalid:')).length;
    return invalidCount / entries.length;
  } catch (error) {
    console.error('Failed to get invalid rate:', error);
    return 0;
  }
}

/**
 * Compute risk assessment for an agent
 */
export async function computeRisk(signals: RiskSignals): Promise<RiskAssessment> {
  const { agentId, agentStatus, agentCreatedAt } = signals;
  
  let score = 0;
  const reasons: string[] = [];

  // Rule 1: Suspended agent -> immediate block
  if (agentStatus === 'suspended') {
    return {
      score: 100,
      recommendedAction: 'block',
      reasons: ['agent_suspended'],
    };
  }

  // Rule 2: New agent (< 7 days) -> +25
  const ageDays = (Date.now() - agentCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 7) {
    score += 25;
    reasons.push('new_agent');
  }

  // Rule 3: High invalid rate (> 20%) -> +20
  const invalidRate = await getInvalidRate(agentId);
  if (invalidRate > THRESHOLDS.invalidRate) {
    score += 20;
    reasons.push('high_invalid_rate');
  }

  // Rule 4: Rate limit hits in last hour -> +20
  const rateLimitHits = await getWindowCount(
    REDIS_KEYS.rateLimitHits(agentId),
    WINDOWS.rateLimit1h
  );
  if (rateLimitHits > THRESHOLDS.rateLimitHits) {
    score += 20;
    reasons.push('rate_limited_often');
  }

  // Rule 5: Burst activity in last 10m -> +15
  const burstActivity = await getWindowCount(
    REDIS_KEYS.burstActivity(agentId),
    WINDOWS.burst10m
  );
  if (burstActivity > THRESHOLDS.burstBaseline) {
    score += 15;
    reasons.push('burst_activity');
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine action based on score
  let recommendedAction: RiskAction;
  if (score >= 60) {
    recommendedAction = 'block';
  } else if (score >= 30) {
    recommendedAction = 'throttle';
  } else {
    recommendedAction = 'allow';
  }

  return { score, recommendedAction, reasons };
}

// Lock key for risk state persistence
const RISK_STATE_LOCK_PREFIX = 'risk:lock:';
const RISK_STATE_TTL_SECONDS = 5 * 60; // 5 minutes between DB writes

/**
 * Persist risk state to database (with rate limiting to avoid DB write storms)
 * Uses a Redis lock to ensure we only write once per 5 minutes per agent
 * Falls back to always persisting if Redis is unavailable
 */
export async function persistRiskState(
  agentId: string,
  assessment: RiskAssessment
): Promise<boolean> {
  // If Redis is available, use lock mechanism
  if (isRedisAvailable()) {
    try {
      const lockKey = `${RISK_STATE_LOCK_PREFIX}${agentId}`;
      
      // Try to acquire lock (SET NX with TTL)
      const acquired = await redis.set(
        lockKey,
        '1',
        'EX',
        RISK_STATE_TTL_SECONDS,
        'NX'
      );
      
      if (!acquired) {
        // Lock exists, skip DB write
        return false;
      }
    } catch (error) {
      console.error('Failed to acquire risk state lock:', error);
      // Continue to persist anyway
    }
  }

  try {
    // Upsert risk state
    await prisma.riskState.upsert({
      where: { agentId },
      create: {
        agentId,
        score: assessment.score,
        recommendedAction: assessment.recommendedAction,
        reasons: assessment.reasons,
        updatedAt: new Date(),
      },
      update: {
        score: assessment.score,
        recommendedAction: assessment.recommendedAction,
        reasons: assessment.reasons,
        updatedAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to persist risk state:', error);
    return false;
  }
}

/**
 * Get cached risk state from database (if available)
 */
export async function getCachedRiskState(agentId: string): Promise<RiskAssessment | null> {
  const state = await prisma.riskState.findUnique({
    where: { agentId },
  });

  if (!state) return null;

  return {
    score: state.score,
    recommendedAction: state.recommendedAction as RiskAction,
    reasons: state.reasons as string[],
  };
}
