/**
 * Token Service - verification, introspection, and revocation of identity tokens
 */

import { prisma } from '../lib/prisma.js';
import { redis, isRedisAvailable, RedisKeys } from '../lib/redis.js';
import { verifyIdentityToken, decodeTokenUnsafe } from './jwt.js';
import { logAuditEvent } from './audit.js';
import { AuditEventType } from '@agent-passport/shared';
import {
  computeRisk,
  persistRiskState,
  recordInvalidAttempt,
  recordValidAttempt,
  recordActivity,
  RiskAssessment,
} from './risk-engine.js';
import { getHumanVerifications, HumanVerificationSummary } from './human-verification.js';

export interface TokenVerifyResult {
  valid: boolean;
  agentId?: string;
  handle?: string;
  scopes?: string[];
  expiresAt?: Date;
  reason?: string;
  risk?: RiskAssessment;
  humanVerification?: HumanVerificationSummary;
}

export interface TokenIntrospectResult {
  active: boolean;
  sub?: string;
  handle?: string;
  scopes?: string[];
  iss?: string;
  iat?: number;
  exp?: number;
  jti?: string;
  client_id?: string; // The app that requested introspection
}

/**
 * Verify an identity token and return agent info if valid
 */
export async function verifyToken(
  token: string,
  appId: string,
  ip?: string
): Promise<TokenVerifyResult> {
  try {
    const result = await verifyIdentityToken(token);

    if (!result.valid) {
      // Log failed verification
      await logVerificationEvent(appId, null, 'invalid', 'token_invalid', ip);
      
      return {
        valid: false,
        reason: 'token_invalid',
      };
    }

    const { payload } = result;
    const agentId = payload.sub;

    // Check revocation blocklist (graceful degradation if Redis unavailable)
    if (isRedisAvailable()) {
      try {
        const isRevoked = await redis.exists(RedisKeys.revoked(payload.jti));
        if (isRevoked) {
          await logVerificationEvent(appId, agentId, 'invalid', 'token_revoked', ip);
          return {
            valid: false,
            reason: 'token_revoked',
          };
        }
      } catch (err: unknown) {
        console.warn('Failed to check revocation blocklist:', err);
        // Graceful degradation — skip revocation check if Redis is down
      }
    }

    // Check if agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      await logVerificationEvent(appId, agentId, 'invalid', 'agent_not_found', ip);
      return {
        valid: false,
        reason: 'agent_not_found',
      };
    }

    // Record activity for risk scoring
    await recordActivity(agentId);

    // Compute risk assessment
    const risk = await computeRisk({
      agentId,
      agentStatus: agent.status as 'active' | 'suspended',
      agentCreatedAt: agent.createdAt,
    });

    // Persist risk state (rate-limited to once per 5 minutes)
    await persistRiskState(agentId, risk);

    if (agent.status !== 'active') {
      await recordInvalidAttempt(agentId);
      await logVerificationEvent(appId, agentId, 'invalid', 'agent_suspended', ip);
      return {
        valid: false,
        reason: 'agent_suspended',
        risk,
      };
    }

    // Record valid attempt
    await recordValidAttempt(agentId);
    
    // Fetch human verification status
    let humanVerification: HumanVerificationSummary | undefined;
    try {
      humanVerification = await getHumanVerifications(agentId);
    } catch (err: unknown) {
      console.warn('Failed to fetch human verification:', err);
      // Graceful degradation — omit human verification info if it fails
    }

    // Token is valid
    await logVerificationEvent(appId, agentId, 'valid', 'ok', ip);

    return {
      valid: true,
      agentId,
      handle: payload.handle as string,
      scopes: payload.scopes as string[] | undefined,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
      risk,
      humanVerification,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    await logVerificationEvent(appId, null, 'error', 'internal_error', ip);
    
    return {
      valid: false,
      reason: 'internal_error',
    };
  }
}

/**
 * Introspect a token - returns detailed info about the token
 * Follows RFC 7662 Token Introspection spec
 */
export async function introspectToken(
  token: string,
  appId: string
): Promise<TokenIntrospectResult> {
  try {
    const result = await verifyIdentityToken(token);

    if (!result.valid) {
      return { active: false };
    }

    const { payload } = result;
    const agentId = payload.sub;

    // Check if agent is still active
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.status !== 'active') {
      return { active: false };
    }

    return {
      active: true,
      sub: payload.sub,
      handle: payload.handle as string,
      scopes: payload.scopes as string[] | undefined,
      iss: 'agent-passport',
      iat: payload.iat,
      exp: payload.exp,
      jti: payload.jti,
      client_id: appId,
    };
  } catch (error) {
    console.error('Token introspection error:', error);
    return { active: false };
  }
}

/**
 * Log a verification event
 */
async function logVerificationEvent(
  appId: string,
  agentId: string | null,
  result: string,
  reason: string,
  ip?: string
): Promise<void> {
  try {
    await prisma.verificationEvent.create({
      data: {
        appId,
        agentId,
        result,
        reason,
        ip,
      },
    });
  } catch (error) {
    console.error('Failed to log verification event:', error);
  }
}

/**
 * Get verification stats for an app
 */
export async function getVerificationStats(appId: string, since?: Date) {
  const whereClause = {
    appId,
    ...(since && { at: { gte: since } }),
  };

  const [total, valid, invalid] = await Promise.all([
    prisma.verificationEvent.count({ where: whereClause }),
    prisma.verificationEvent.count({ where: { ...whereClause, result: 'valid' } }),
    prisma.verificationEvent.count({ where: { ...whereClause, result: 'invalid' } }),
  ]);

  return {
    total,
    valid,
    invalid,
    successRate: total > 0 ? (valid / total) * 100 : 0,
  };
}

// ============================================================================
// Token Revocation
// ============================================================================

export interface TokenRevokeResult {
  revoked: boolean;
  jti: string;
  expiresAt?: string;
  reason?: string;
}

/**
 * Revoke a token by adding its JTI to the Redis blocklist.
 * The blocklist entry auto-expires when the token would have expired anyway.
 */
export async function revokeToken(
  token: string,
  appId: string,
  ip?: string,
): Promise<TokenRevokeResult> {
  // Decode without verification — we just need the jti and exp
  const payload = decodeTokenUnsafe(token);

  if (!payload || !payload.jti || typeof payload.jti !== 'string') {
    return { revoked: false, jti: '', reason: 'invalid_token' };
  }

  const jti = payload.jti;
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.max(exp - now, 1); // At least 1 second

  // Add to Redis blocklist with TTL matching token expiry
  if (isRedisAvailable()) {
    try {
      await redis.set(RedisKeys.revoked(jti), '1', 'EX', ttlSeconds);
    } catch (err: unknown) {
      console.error('Failed to add token to revocation blocklist:', err);
      return { revoked: false, jti, reason: 'redis_unavailable' };
    }
  } else {
    console.warn('Redis unavailable — token revocation cannot be persisted');
    return { revoked: false, jti, reason: 'redis_unavailable' };
  }

  // Audit log
  try {
    await logAuditEvent({
      eventType: AuditEventType.TOKEN_REVOKED,
      actorType: 'app',
      actorId: appId,
      ip,
      metadata: { jti, exp, ttlSeconds },
    });
  } catch {
    // Best-effort audit logging
  }

  return {
    revoked: true,
    jti,
    expiresAt: exp ? new Date(exp * 1000).toISOString() : undefined,
  };
}
