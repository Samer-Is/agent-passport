import { z } from 'zod';

// ============================================================================
// Agent Schemas
// ============================================================================

export const handleSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9_-]+$/, 'Handle must be lowercase alphanumeric with underscores or hyphens');

export const publicKeyB64Schema = z
  .string()
  .min(40)
  .max(100)
  .regex(/^[A-Za-z0-9+/=]+$/, 'Public key must be valid base64');

export const registerAgentRequestSchema = z.object({
  handle: handleSchema,
  publicKeyB64: publicKeyB64Schema,
});

export const registerAgentResponseSchema = z.object({
  agentId: z.string().uuid(),
});

export const challengeResponseSchema = z.object({
  challengeId: z.string().uuid(),
  nonce: z.string(),
  expiresAt: z.string().datetime(),
});

export const identityTokenRequestSchema = z.object({
  challengeId: z.string().uuid(),
  signatureB64: z.string().regex(/^[A-Za-z0-9+/=]+$/, 'Signature must be valid base64'),
  scopes: z.array(z.string()).optional().default([]),
});

export const identityTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
});

export const addKeyRequestSchema = z.object({
  publicKeyB64: publicKeyB64Schema,
});

export const addKeyResponseSchema = z.object({
  keyId: z.string().uuid(),
});

export const revokeKeyResponseSchema = z.object({
  ok: z.literal(true),
});

// ============================================================================
// App / Verification Schemas
// ============================================================================

export const verifyIdentityRequestSchema = z.object({
  token: z.string(),
});

export const agentStatusSchema = z.enum(['active', 'suspended']);

export const riskActionSchema = z.enum(['allow', 'throttle', 'block']);

// ============================================================================
// Human Verification Schemas
// ============================================================================

export const humanVerificationProviderSchema = z.enum([
  'github',
  'mercle',
  'google',
  'email',
  'phone',
  'worldcoin',
  'civic',
]);

export const linkHumanVerificationRequestSchema = z.object({
  provider: humanVerificationProviderSchema,
  providerId: z.string().min(1).max(255),
  displayName: z.string().max(255).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const humanVerificationInfoSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  providerId: z.string(),
  displayName: z.string().nullable(),
  verifiedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  status: z.enum(['active', 'expired', 'revoked']),
});

export const humanVerificationSummarySchema = z.object({
  verified: z.boolean(),
  verifications: z.array(humanVerificationInfoSchema),
});

export const verifyIdentityResponseSchema = z.object({
  valid: z.boolean(),
  agent: z
    .object({
      id: z.string().uuid(),
      handle: z.string(),
      createdAt: z.string().datetime(),
      status: agentStatusSchema,
    })
    .optional(),
  claims: z
    .object({
      scopes: z.array(z.string()),
      exp: z.number(),
      iat: z.number(),
      jti: z.string(),
    })
    .optional(),
  risk: z
    .object({
      score: z.number().min(0).max(100),
      recommendedAction: riskActionSchema,
      reasons: z.array(z.string()),
    })
    .optional(),
  humanVerification: humanVerificationSummarySchema.optional(),
});

// ============================================================================
// Portal Schemas
// ============================================================================

export const createAppRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createAppResponseSchema = z.object({
  appId: z.string().uuid(),
});

export const appSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  status: z.enum(['active', 'suspended']),
});

export const listAppsResponseSchema = z.object({
  apps: z.array(appSchema),
});

export const generateAppKeyResponseSchema = z.object({
  appKeyId: z.string().uuid(),
  appKeyRaw: z.string(), // Only shown once!
});

export const usageQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const usageResponseSchema = z.object({
  totalVerifications: z.number(),
  validVerifications: z.number(),
  invalidVerifications: z.number(),
  dailyBreakdown: z.array(
    z.object({
      date: z.string(),
      total: z.number(),
      valid: z.number(),
      invalid: z.number(),
    })
  ),
});

// ============================================================================
// Revocation Schemas
// ============================================================================

export const revokeTokenRequestSchema = z.object({
  token: z.string().min(1),
});

/** Alias matching chunk2 spec naming convention */
export const RevokeTokenSchema = revokeTokenRequestSchema;

export const revokeTokenResponseSchema = z.object({
  revoked: z.literal(true),
  jti: z.string(),
  expiresAt: z.string().datetime().optional(),
});

// ============================================================================
// Error Schemas
// ============================================================================

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  request_id: z.string(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type RegisterAgentRequest = z.infer<typeof registerAgentRequestSchema>;
export type RegisterAgentResponse = z.infer<typeof registerAgentResponseSchema>;
export type ChallengeResponse = z.infer<typeof challengeResponseSchema>;
export type IdentityTokenRequest = z.infer<typeof identityTokenRequestSchema>;
export type IdentityTokenResponse = z.infer<typeof identityTokenResponseSchema>;
export type AddKeyRequest = z.infer<typeof addKeyRequestSchema>;
export type AddKeyResponse = z.infer<typeof addKeyResponseSchema>;
export type RevokeKeyResponse = z.infer<typeof revokeKeyResponseSchema>;
export type VerifyIdentityRequest = z.infer<typeof verifyIdentityRequestSchema>;
export type VerifyIdentityResponse = z.infer<typeof verifyIdentityResponseSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;
export type RiskAction = z.infer<typeof riskActionSchema>;
export type CreateAppRequest = z.infer<typeof createAppRequestSchema>;
export type CreateAppResponse = z.infer<typeof createAppResponseSchema>;
export type App = z.infer<typeof appSchema>;
export type ListAppsResponse = z.infer<typeof listAppsResponseSchema>;
export type GenerateAppKeyResponse = z.infer<typeof generateAppKeyResponseSchema>;
export type UsageQuery = z.infer<typeof usageQuerySchema>;
export type UsageResponse = z.infer<typeof usageResponseSchema>;
export type RevokeTokenRequest = z.infer<typeof revokeTokenRequestSchema>;
export type RevokeTokenResponse = z.infer<typeof revokeTokenResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type LinkHumanVerificationRequest = z.infer<typeof linkHumanVerificationRequestSchema>;
export type HumanVerificationInfo = z.infer<typeof humanVerificationInfoSchema>;
export type HumanVerificationSummary = z.infer<typeof humanVerificationSummarySchema>;
export type HumanVerificationProvider = z.infer<typeof humanVerificationProviderSchema>;
