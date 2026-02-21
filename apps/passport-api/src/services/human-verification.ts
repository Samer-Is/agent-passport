/**
 * Human Verification Service
 *
 * Links agents to verified human identities from external providers
 * (e.g. GitHub, Mercle, Google, email). Creates the accountability chain:
 *
 *   Human (verified) → Agent Passport → Agent = full accountability
 */

import { prisma } from '../lib/prisma.js';
import { logAuditEvent, AuditEventType } from './audit.js';
import { AppError, ErrorCode } from '../errors/app-error.js';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface LinkHumanVerificationParams {
  agentId: string;
  provider: string;
  providerId: string;
  displayName?: string;
  expiresAt?: Date;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

export interface HumanVerificationInfo {
  id: string;
  provider: string;
  providerId: string;
  displayName: string | null;
  verifiedAt: string;
  expiresAt: string | null;
  status: string;
}

export interface HumanVerificationSummary {
  verified: boolean;
  verifications: HumanVerificationInfo[];
}

// ============================================================================
// Link a human verification to an agent
// ============================================================================

export async function linkHumanVerification(
  params: LinkHumanVerificationParams,
): Promise<HumanVerificationInfo> {
  const { agentId, provider, providerId, displayName, expiresAt, metadata, ip } = params;

  // Validate provider
  const allowedProviders = ['github', 'mercle', 'google', 'email', 'phone', 'worldcoin', 'civic'];
  if (!allowedProviders.includes(provider.toLowerCase())) {
    throw AppError.badRequest(
      ErrorCode.VALIDATION_ERROR,
      `Unsupported provider: ${provider}. Allowed: ${allowedProviders.join(', ')}`,
    );
  }

  // Check agent exists
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw AppError.notFound(ErrorCode.AGENT_NOT_FOUND, 'Agent not found');
  }

  // Upsert — update if same (agent, provider) exists, otherwise create
  const verification = await prisma.humanVerification.upsert({
    where: {
      agentId_provider: { agentId, provider: provider.toLowerCase() },
    },
    update: {
      providerId,
      displayName: displayName ?? null,
      expiresAt: expiresAt ?? null,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      status: 'active',
      verifiedAt: new Date(),
    },
    create: {
      agentId,
      provider: provider.toLowerCase(),
      providerId,
      displayName: displayName ?? null,
      expiresAt: expiresAt ?? null,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  logAuditEvent({
    eventType: AuditEventType.HUMAN_VERIFICATION_LINKED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { provider: provider.toLowerCase(), providerId },
  });

  return formatVerification(verification);
}

// ============================================================================
// Get human verifications for an agent
// ============================================================================

export async function getHumanVerifications(
  agentId: string,
): Promise<HumanVerificationSummary> {
  const verifications = await prisma.humanVerification.findMany({
    where: {
      agentId,
      status: 'active',
    },
    orderBy: { verifiedAt: 'desc' },
  });

  // Auto-expire any that are past their expiresAt
  const now = new Date();
  const active: HumanVerificationInfo[] = [];

  for (const v of verifications) {
    if (v.expiresAt && v.expiresAt < now) {
      // Mark expired in DB (fire-and-forget)
      prisma.humanVerification
        .update({ where: { id: v.id }, data: { status: 'expired' } })
        .catch(() => {});
      continue;
    }
    active.push(formatVerification(v));
  }

  return {
    verified: active.length > 0,
    verifications: active,
  };
}

// ============================================================================
// Revoke a human verification
// ============================================================================

export async function revokeHumanVerification(
  agentId: string,
  provider: string,
  ip?: string,
): Promise<void> {
  const verification = await prisma.humanVerification.findUnique({
    where: {
      agentId_provider: { agentId, provider: provider.toLowerCase() },
    },
  });

  if (!verification) {
    throw AppError.notFound(
      ErrorCode.NOT_FOUND,
      `No ${provider} verification found for this agent`,
    );
  }

  await prisma.humanVerification.update({
    where: { id: verification.id },
    data: { status: 'revoked' },
  });

  logAuditEvent({
    eventType: AuditEventType.HUMAN_VERIFICATION_REVOKED,
    actorType: 'agent',
    actorId: agentId,
    ip,
    metadata: { provider: provider.toLowerCase() },
  });
}

// ============================================================================
// Helpers
// ============================================================================

function formatVerification(v: {
  id: string;
  provider: string;
  providerId: string;
  displayName: string | null;
  verifiedAt: Date;
  expiresAt: Date | null;
  status: string;
}): HumanVerificationInfo {
  return {
    id: v.id,
    provider: v.provider,
    providerId: v.providerId,
    displayName: v.displayName,
    verifiedAt: v.verifiedAt.toISOString(),
    expiresAt: v.expiresAt?.toISOString() ?? null,
    status: v.status,
  };
}
