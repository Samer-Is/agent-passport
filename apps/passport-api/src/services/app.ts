/**
 * App Service - application registration and key management
 */

import { prisma } from '../lib/prisma.js';
import { generateNonce } from '../lib/crypto.js';
import { logAuditEvent } from './audit.js';
import * as argon2 from 'argon2';

// Generate a random app key
function generateAppKey(): string {
  // Format: ap_live_<32 random hex chars>
  const randomPart = generateNonce(32);
  return `ap_live_${randomPart}`;
}

// Generate a 12-char prefix for display/lookup
function generateKeyPrefix(fullKey: string): string {
  return fullKey.slice(0, 12);
}

// Hash the app key using argon2id
async function hashAppKey(key: string): Promise<string> {
  return argon2.hash(key, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

// Verify an app key against its hash
export async function verifyAppKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key);
  } catch {
    return false;
  }
}

export interface RegisterAppParams {
  name: string;
  description?: string;
  allowedScopes?: string[];
  allowedCallbackUrls?: string[];
  portalUserId: string;
}

export interface RegisterAppResult {
  app: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    allowedScopes: string[];
    createdAt: Date;
  };
  key: {
    id: string;
    prefix: string;
    fullKey: string; // Only returned on creation!
  };
}

/**
 * Register a new application and generate its first API key
 */
export async function registerApp(params: RegisterAppParams): Promise<RegisterAppResult> {
  const { name, description, allowedScopes = [], allowedCallbackUrls = [], portalUserId } = params;

  // Generate the app key
  const fullKey = generateAppKey();
  const keyPrefix = generateKeyPrefix(fullKey);
  const keyHash = await hashAppKey(fullKey);

  // Create app and key in a transaction
  const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    const app = await tx.app.create({
      data: {
        name,
        description,
        allowedScopes,
        allowedCallbackUrls,
        status: 'active',
        portalUserId,
      },
    });

    const appKey = await tx.appKey.create({
      data: {
        appId: app.id,
        keyPrefix,
        keyHash,
        status: 'active',
      },
    });

    return { app, appKey };
  });

  // Log audit event
  await logAuditEvent({
    eventType: 'APP_CREATED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: result.app.id,
    metadata: {
      appName: name,
      keyPrefix,
    },
    outcome: 'SUCCESS',
  });

  return {
    app: {
      id: result.app.id,
      name: result.app.name,
      description: result.app.description,
      status: result.app.status,
      allowedScopes: result.app.allowedScopes,
      createdAt: result.app.createdAt,
    },
    key: {
      id: result.appKey.id,
      prefix: keyPrefix,
      fullKey, // Only time this is available!
    },
  };
}

/**
 * Get app by ID
 */
export async function getApp(appId: string) {
  return prisma.app.findUnique({
    where: { id: appId },
    include: {
      keys: {
        select: {
          id: true,
          keyPrefix: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
        },
      },
    },
  });
}

/**
 * List all apps for a portal user
 */
export async function listApps(portalUserId: string) {
  return prisma.app.findMany({
    where: { portalUserId },
    include: {
      keys: {
        select: {
          id: true,
          keyPrefix: true,
          status: true,
          lastUsedAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          verificationEvents: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update app settings
 */
export async function updateApp(
  appId: string,
  portalUserId: string,
  updates: {
    name?: string;
    description?: string;
    allowedScopes?: string[];
    allowedCallbackUrls?: string[];
  }
) {
  const app = await prisma.app.findFirst({
    where: { id: appId, portalUserId },
  });

  if (!app) {
    return null;
  }

  const updated = await prisma.app.update({
    where: { id: appId },
    data: updates,
  });

  await logAuditEvent({
    eventType: 'APP_UPDATED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: appId,
    metadata: { updates },
    outcome: 'SUCCESS',
  });

  return updated;
}

/**
 * Deactivate an app
 */
export async function deactivateApp(appId: string, portalUserId: string) {
  const app = await prisma.app.findFirst({
    where: { id: appId, portalUserId },
  });

  if (!app) {
    return null;
  }

  const updated = await prisma.app.update({
    where: { id: appId },
    data: { status: 'suspended' },
  });

  await logAuditEvent({
    eventType: 'APP_SUSPENDED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: appId,
    outcome: 'SUCCESS',
  });

  return updated;
}

/**
 * Create a new API key for an app (without revoking existing keys)
 */
export async function createAppKey(appId: string, portalUserId: string, name?: string) {
  // Verify ownership
  const app = await prisma.app.findFirst({
    where: { id: appId, portalUserId },
  });

  if (!app) {
    return null;
  }

  // Generate new key
  const fullKey = generateAppKey();
  const keyPrefix = generateKeyPrefix(fullKey);
  const keyHash = await hashAppKey(fullKey);

  const newKey = await prisma.appKey.create({
    data: {
      appId,
      keyPrefix,
      keyHash,
      name: name || null,
      status: 'active',
    },
  });

  await logAuditEvent({
    eventType: 'APP_KEY_CREATED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: appId,
    metadata: { keyPrefix, keyName: name },
    outcome: 'SUCCESS',
  });

  return {
    id: newKey.id,
    prefix: keyPrefix,
    fullKey, // Only time available!
  };
}

/**
 * Revoke a specific API key
 */
export async function revokeAppKey(keyId: string, appId: string, portalUserId: string) {
  // Verify ownership
  const app = await prisma.app.findFirst({
    where: { id: appId, portalUserId },
  });

  if (!app) {
    return null;
  }

  const key = await prisma.appKey.findFirst({
    where: { id: keyId, appId },
  });

  if (!key) {
    return null;
  }

  const updated = await prisma.appKey.update({
    where: { id: keyId },
    data: { status: 'revoked' },
  });

  await logAuditEvent({
    eventType: 'APP_KEY_REVOKED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: appId,
    metadata: { keyId, keyPrefix: key.keyPrefix },
    outcome: 'SUCCESS',
  });

  return updated;
}

/**
 * Generate a new API key for an app (rotates - revokes all existing)
 */
export async function rotateAppKey(appId: string, portalUserId: string) {
  // Verify ownership
  const app = await prisma.app.findFirst({
    where: { id: appId, portalUserId },
  });

  if (!app) {
    return null;
  }

  // Generate new key
  const fullKey = generateAppKey();
  const keyPrefix = generateKeyPrefix(fullKey);
  const keyHash = await hashAppKey(fullKey);

  // Revoke old keys and create new one
  const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
    // Mark all existing active keys as revoked
    await tx.appKey.updateMany({
      where: { appId, status: 'active' },
      data: { status: 'revoked' },
    });

    // Create new key
    const newKey = await tx.appKey.create({
      data: {
        appId,
        keyPrefix,
        keyHash,
        status: 'active',
      },
    });

    return newKey;
  });

  await logAuditEvent({
    eventType: 'APP_KEY_ROTATED',
    actorType: 'portal_user',
    actorId: portalUserId,
    targetType: 'APP',
    targetId: appId,
    metadata: { newKeyPrefix: keyPrefix },
    outcome: 'SUCCESS',
  });

  return {
    id: result.id,
    prefix: keyPrefix,
    fullKey, // Only time available!
  };
}

/**
 * Validate an app API key and return app info if valid
 */
export async function validateAppApiKey(apiKey: string) {
  // Extract prefix for lookup
  const prefix = generateKeyPrefix(apiKey);

  // Find keys with matching prefix
  const keys = await prisma.appKey.findMany({
    where: {
      keyPrefix: prefix,
      status: 'active',
    },
    include: {
      app: true,
    },
  });

  // Verify the full key against each candidate
  for (const key of keys) {
    const isValid = await verifyAppKey(apiKey, key.keyHash);
    if (isValid && key.app.status === 'active') {
      // Update last used
      await prisma.appKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        valid: true,
        app: key.app,
        keyId: key.id,
      };
    }
  }

  return { valid: false, app: null, keyId: null };
}
