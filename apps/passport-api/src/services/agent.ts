import { prisma } from '../lib/prisma.js';
import { redis, RedisKeys } from '../lib/redis.js';
import { verifySignature, isValidPublicKey, generateNonce } from '../lib/crypto.js';
import { createIdentityToken, verifyIdentityToken } from './jwt.js';
import { logAuditEvent, AuditEventType } from './audit.js';
import { AppError, ErrorCode } from '../errors/app-error.js';
import { config } from '../config/index.js';
import type { Agent, AgentKey } from '@prisma/client';

// ============================================================================
// Agent Registration
// ============================================================================

export interface RegisterAgentParams {
  handle: string;
  publicKeyB64: string;
  ip?: string;
}

export interface RegisterAgentResult {
  agentId: string;
}

export async function registerAgent(params: RegisterAgentParams): Promise<RegisterAgentResult> {
  const { handle, publicKeyB64, ip } = params;

  // Validate public key format
  if (!isValidPublicKey(publicKeyB64)) {
    throw AppError.badRequest(ErrorCode.INVALID_PUBLIC_KEY, 'Invalid Ed25519 public key');
  }

  // Check if handle is taken
  const existing = await prisma.agent.findUnique({
    where: { handle },
  });

  if (existing) {
    throw AppError.badRequest(ErrorCode.HANDLE_TAKEN, 'Handle is already taken');
  }

  // Create agent with initial key
  const agent = await prisma.agent.create({
    data: {
      handle,
      status: 'active',
      keys: {
        create: {
          publicKeyB64,
        },
      },
    },
  });

  // Log audit event
  logAuditEvent({
    eventType: AuditEventType.AGENT_REGISTERED,
    actorType: 'agent',
    actorId: agent.id,
    ip,
    metadata: { handle },
  });

  return { agentId: agent.id };
}

// ============================================================================
// Challenge Issuance
// ============================================================================

export interface IssueChallengeParams {
  agentId: string;
  ip?: string;
}

export interface IssueChallengeResult {
  challengeId: string;
  nonce: string;
  expiresAt: Date;
}

export async function issueChallenge(params: IssueChallengeParams): Promise<IssueChallengeResult> {
  const { agentId, ip } = params;

  // Verify agent exists and is active
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw AppError.notFound(ErrorCode.AGENT_NOT_FOUND, 'Agent not found');
  }

  if (agent.status === 'suspended') {
    throw AppError.forbidden(ErrorCode.AGENT_SUSPENDED, 'Agent is suspended');
  }

  // Generate challenge
  const nonce = generateNonce(32);
  const expiresAt = new Date(Date.now() + config.challengeTtlMinutes * 60 * 1000);

  const challenge = await prisma.challenge.create({
    data: {
      agentId,
      nonce,
      expiresAt,
    },
  });

  // Store in Redis for fast lookup (optional, DB is source of truth)
  await redis.set(
    RedisKeys.challengeNonce(challenge.id),
    nonce,
    'EX',
    config.challengeTtlMinutes * 60
  );

  // Log audit event
  logAuditEvent({
    eventType: AuditEventType.CHALLENGE_ISSUED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { challengeId: challenge.id },
  });

  return {
    challengeId: challenge.id,
    nonce,
    expiresAt,
  };
}

// ============================================================================
// Token Issuance
// ============================================================================

export interface IssueTokenParams {
  agentId: string;
  challengeId: string;
  signatureB64: string;
  scopes?: string[];
  ip?: string;
}

export interface IssueTokenResult {
  token: string;
  expiresAt: Date;
}

export async function issueIdentityToken(params: IssueTokenParams): Promise<IssueTokenResult> {
  const { agentId, challengeId, signatureB64, scopes = [], ip } = params;

  // Get challenge
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'challenge_not_found', challengeId },
    });
    throw AppError.badRequest(ErrorCode.CHALLENGE_NOT_FOUND, 'Challenge not found');
  }

  // Verify challenge belongs to this agent
  if (challenge.agentId !== agentId) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'challenge_agent_mismatch', challengeId },
    });
    throw AppError.badRequest(ErrorCode.CHALLENGE_NOT_FOUND, 'Challenge not found');
  }

  // Check if already used
  if (challenge.usedAt) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'challenge_already_used', challengeId },
    });
    throw AppError.badRequest(ErrorCode.CHALLENGE_ALREADY_USED, 'Challenge has already been used');
  }

  // Check if expired
  if (new Date() > challenge.expiresAt) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'challenge_expired', challengeId },
    });
    throw AppError.badRequest(ErrorCode.CHALLENGE_EXPIRED, 'Challenge has expired');
  }

  // Get agent with active keys
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      keys: {
        where: { revokedAt: null },
      },
    },
  });

  if (!agent) {
    throw AppError.notFound(ErrorCode.AGENT_NOT_FOUND, 'Agent not found');
  }

  if (agent.status === 'suspended') {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'agent_suspended' },
    });
    throw AppError.forbidden(ErrorCode.AGENT_SUSPENDED, 'Agent is suspended');
  }

  if (agent.keys.length === 0) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'no_active_keys' },
    });
    throw AppError.badRequest(ErrorCode.NO_ACTIVE_KEYS, 'Agent has no active keys');
  }

  // Try to verify signature against any active key
  let signatureValid = false;
  for (const key of agent.keys) {
    const valid = await verifySignature(signatureB64, challenge.nonce, key.publicKeyB64);
    if (valid) {
      signatureValid = true;
      break;
    }
  }

  if (!signatureValid) {
    logAuditEvent({
      eventType: AuditEventType.TOKEN_ISSUE_FAILED,
      actorType: 'agent',
      actorId: agentId,
      ip,
      metadata: { reason: 'invalid_signature', challengeId },
    });
    throw AppError.unauthorized(ErrorCode.INVALID_SIGNATURE, 'Invalid signature');
  }

  // Mark challenge as used
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { usedAt: new Date() },
  });

  // Clean up Redis
  await redis.del(RedisKeys.challengeNonce(challengeId));

  // Issue token
  const { token, expiresAt, jti } = await createIdentityToken({
    agentId: agent.id,
    handle: agent.handle,
    scopes,
  });

  // Log audit event
  logAuditEvent({
    eventType: AuditEventType.TOKEN_ISSUED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { jti, scopes },
  });

  return { token, expiresAt };
}

// ============================================================================
// Key Management
// ============================================================================

export interface AddKeyParams {
  agentId: string;
  publicKeyB64: string;
  ip?: string;
}

export async function addAgentKey(params: AddKeyParams): Promise<{ keyId: string }> {
  const { agentId, publicKeyB64, ip } = params;

  // Validate public key format
  if (!isValidPublicKey(publicKeyB64)) {
    throw AppError.badRequest(ErrorCode.INVALID_PUBLIC_KEY, 'Invalid Ed25519 public key');
  }

  // Verify agent exists
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    throw AppError.notFound(ErrorCode.AGENT_NOT_FOUND, 'Agent not found');
  }

  // Create new key
  const key = await prisma.agentKey.create({
    data: {
      agentId,
      publicKeyB64,
    },
  });

  // Log audit event
  logAuditEvent({
    eventType: AuditEventType.KEY_ADDED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { keyId: key.id },
  });

  return { keyId: key.id };
}

export interface RevokeKeyParams {
  agentId: string;
  keyId: string;
  ip?: string;
}

export async function revokeAgentKey(params: RevokeKeyParams): Promise<void> {
  const { agentId, keyId, ip } = params;

  // Get key
  const key = await prisma.agentKey.findUnique({
    where: { id: keyId },
  });

  if (!key || key.agentId !== agentId) {
    throw AppError.notFound(ErrorCode.KEY_NOT_FOUND, 'Key not found');
  }

  if (key.revokedAt) {
    throw AppError.badRequest(ErrorCode.KEY_ALREADY_REVOKED, 'Key is already revoked');
  }

  // Revoke key
  await prisma.agentKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  // Log audit event
  logAuditEvent({
    eventType: AuditEventType.KEY_REVOKED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { keyId },
  });
}

// ============================================================================
// Agent Lookup
// ============================================================================

export async function getAgentById(agentId: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { id: agentId },
  });
}

export async function getAgentWithKeys(agentId: string): Promise<(Agent & { keys: AgentKey[] }) | null> {
  return prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      keys: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

// Re-export token verification for use in auth middleware
export { verifyIdentityToken };
