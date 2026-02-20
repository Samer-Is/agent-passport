/**
 * Portal User Service - admin user management
 */

import { prisma } from '../lib/prisma.js';
import { logAuditEvent } from './audit.js';
import * as argon2 from 'argon2';

/**
 * Hash a password using argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export interface CreatePortalUserParams {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * Create a new portal user
 */
export async function createPortalUser(params: CreatePortalUserParams) {
  const { email, password, displayName } = params;
  
  // Check if user already exists
  const existing = await prisma.portalUser.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.portalUser.create({
    data: {
      email,
      passwordHash,
      displayName,
      status: 'active',
    },
  });

  await logAuditEvent({
    eventType: 'PORTAL_USER_CREATED',
    actorType: 'portal_user',
    actorId: user.id,
    targetType: 'PORTAL_USER',
    targetId: user.id,
    metadata: { email },
    outcome: 'SUCCESS',
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/**
 * Authenticate a portal user
 */
export async function authenticatePortalUser(email: string, password: string) {
  const user = await prisma.portalUser.findUnique({
    where: { email },
  });

  if (!user) {
    // Log failed attempt
    await logAuditEvent({
      eventType: 'PORTAL_LOGIN_FAILED',
      actorType: 'portal_user',
      actorId: 'unknown',
      metadata: { email, reason: 'user_not_found' },
      outcome: 'FAILURE',
    });
    return null;
  }

  if (user.status !== 'active') {
    await logAuditEvent({
      eventType: 'PORTAL_LOGIN_FAILED',
      actorType: 'portal_user',
      actorId: user.id,
      metadata: { email, reason: 'account_inactive', status: user.status },
      outcome: 'FAILURE',
    });
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    await logAuditEvent({
      eventType: 'PORTAL_LOGIN_FAILED',
      actorType: 'portal_user',
      actorId: user.id,
      metadata: { email, reason: 'invalid_password' },
      outcome: 'FAILURE',
    });
    return null;
  }

  // Update last login
  await prisma.portalUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await logAuditEvent({
    eventType: 'PORTAL_LOGIN_SUCCESS',
    actorType: 'portal_user',
    actorId: user.id,
    metadata: { email },
    outcome: 'SUCCESS',
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}

/**
 * Get portal user by ID
 */
export async function getPortalUser(userId: string) {
  const user = await prisma.portalUser.findUnique({
    where: { id: userId },
    include: {
      apps: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    apps: user.apps,
  };
}

/**
 * Update portal user
 */
export async function updatePortalUser(
  userId: string,
  updates: {
    displayName?: string;
    password?: string;
  }
) {
  const data: { displayName?: string; passwordHash?: string } = {};
  
  if (updates.displayName !== undefined) {
    data.displayName = updates.displayName;
  }
  
  if (updates.password) {
    data.passwordHash = await hashPassword(updates.password);
  }

  const user = await prisma.portalUser.update({
    where: { id: userId },
    data,
  });

  await logAuditEvent({
    eventType: 'PORTAL_USER_UPDATED',
    actorType: 'portal_user',
    actorId: userId,
    targetType: 'PORTAL_USER',
    targetId: userId,
    metadata: { updatedFields: Object.keys(updates) },
    outcome: 'SUCCESS',
  });

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}

/**
 * Change portal user password (requires current password verification)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.portalUser.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);

  await prisma.portalUser.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  await logAuditEvent({
    eventType: 'PORTAL_PASSWORD_CHANGED',
    actorType: 'portal_user',
    actorId: userId,
    targetType: 'PORTAL_USER',
    targetId: userId,
    outcome: 'SUCCESS',
  });

  return { success: true };
}
