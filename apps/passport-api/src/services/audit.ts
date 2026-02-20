import { prisma } from '../lib/prisma.js';
import type { ActorType, Prisma } from '@prisma/client';

export interface AuditLogParams {
  eventType: string;
  actorType: ActorType;
  actorId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
  // Additional optional fields for convenience (stored in metadata)
  targetType?: string;
  targetId?: string;
  outcome?: 'SUCCESS' | 'FAILURE';
}

/**
 * Log an audit event (fire and forget - doesn't block the request)
 */
export function logAuditEvent(params: AuditLogParams): void {
  const { eventType, actorType, actorId, ip, metadata = {}, targetType, targetId, outcome } = params;

  // Merge additional fields into metadata
  const fullMetadata = {
    ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
    ...(targetType && { targetType }),
    ...(targetId && { targetId }),
    ...(outcome && { outcome }),
  };

  // Fire and forget - don't await
  prisma.auditEvent
    .create({
      data: {
        eventType,
        actorType,
        actorId,
        ip,
        metadata: fullMetadata as Prisma.InputJsonValue,
      },
    })
    .catch((err: unknown) => {
      console.error('Failed to log audit event:', err);
    });
}

/**
 * Log an audit event and wait for it to complete
 */
export async function logAuditEventAsync(params: AuditLogParams): Promise<void> {
  const { eventType, actorType, actorId, ip, metadata = {}, targetType, targetId, outcome } = params;

  // Merge additional fields into metadata
  const fullMetadata = {
    ...(typeof metadata === 'object' && metadata !== null ? metadata : {}),
    ...(targetType && { targetType }),
    ...(targetId && { targetId }),
    ...(outcome && { outcome }),
  };

  await prisma.auditEvent.create({
    data: {
      eventType,
      actorType,
      actorId,
      ip,
      metadata: fullMetadata as Prisma.InputJsonValue,
    },
  });
}

// Re-export common event types for convenience
export { AuditEventType, ActorType as AuditActorType } from '@agent-passport/shared';
