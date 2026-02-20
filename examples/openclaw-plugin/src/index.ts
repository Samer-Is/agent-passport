/**
 * @agent-passport/openclaw-plugin
 *
 * Core module — framework-agnostic Agent Passport verification for
 * OpenClaw-style agent ecosystems.
 *
 * Use the `/express` or `/fastify` subpath exports for framework-specific
 * middleware. Or use `createVerifier()` directly for custom integrations.
 */

import { AgentPassportClient } from '@zerobase-labs/passport-sdk';
import type { VerifyResult, RiskAction } from '@zerobase-labs/passport-sdk';

// ── Types ──────────────────────────────────────────────────────────────

export interface PluginOptions {
  /** Agent Passport API base URL */
  baseUrl: string;
  /** Your application's ID (from the Agent Passport Portal) */
  appId: string;
  /** Your application's API key */
  appKey: string;
  /**
   * Header name that carries the agent's JWT identity token.
   * @default 'x-agent-token'
   */
  tokenHeader?: string;
  /**
   * Risk actions that should be blocked. Agents with these risk actions
   * will receive a 403 response.
   * @default ['block']
   */
  blockActions?: RiskAction[];
  /**
   * Optional callback invoked on every successful verification.
   * Useful for logging, metrics, or custom side-effects.
   */
  onVerified?: (result: VerifiedAgent) => void | Promise<void>;
  /**
   * Optional callback invoked when verification fails.
   * Useful for alerting or monitoring.
   */
  onRejected?: (reason: string, token?: string) => void | Promise<void>;
}

export interface VerifiedAgent {
  agentId: string;
  handle: string | null;
  risk: {
    score: number;
    action: string;
    reasons: string[];
  };
}

export interface VerificationOutcome {
  verified: true;
  agent: VerifiedAgent;
}

export interface VerificationFailure {
  verified: false;
  status: 401 | 403;
  error: string;
  reason?: string;
  risk?: VerifyResult['risk'];
}

export type VerificationResult = VerificationOutcome | VerificationFailure;

// ── Core Verifier ──────────────────────────────────────────────────────

/**
 * Creates a framework-agnostic verification function.
 *
 * This is the building block used by the Express and Fastify middleware.
 * Use it directly for custom integrations or non-Express/Fastify frameworks.
 *
 * @example
 * ```ts
 * const verify = createVerifier({
 *   baseUrl: 'https://agent-passport.onrender.com',
 *   appId: 'your-app-id',
 *   appKey: 'your-app-key',
 * });
 *
 * // In your handler:
 * const token = getTokenFromRequest(req);
 * const result = await verify(token);
 * if (result.verified) {
 *   console.log('Agent:', result.agent.handle);
 * }
 * ```
 */
export function createVerifier(options: PluginOptions) {
  const {
    baseUrl,
    appId,
    appKey,
    blockActions = ['block'],
    onVerified,
    onRejected,
  } = options;

  const client = new AgentPassportClient({ baseUrl, appId, appKey });

  return async function verify(token: string | undefined): Promise<VerificationResult> {
    if (!token) {
      await onRejected?.('Missing agent token');
      return {
        verified: false,
        status: 401,
        error: 'Missing agent identity token',
      };
    }

    try {
      const result = await client.verify(token);

      if (!result.valid) {
        await onRejected?.(result.reason ?? 'Invalid token', token);
        return {
          verified: false,
          status: 401,
          error: 'Invalid agent identity',
          reason: result.reason,
        };
      }

      // Check risk action
      if (blockActions.includes(result.risk.action as RiskAction)) {
        await onRejected?.(`Blocked by risk engine: ${result.risk.action}`, token);
        return {
          verified: false,
          status: 403,
          error: 'Agent blocked by risk engine',
          risk: result.risk,
        };
      }

      const agent: VerifiedAgent = {
        agentId: result.agentId,
        handle: result.handle ?? null,
        risk: result.risk,
      };

      await onVerified?.(agent);

      return { verified: true, agent };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      await onRejected?.(message, token);
      return {
        verified: false,
        status: 401,
        error: message,
      };
    }
  };
}

// Re-export SDK types for convenience
export type { VerifyResult, RiskAction } from '@zerobase-labs/passport-sdk';
export { AgentPassportClient, AgentClient } from '@zerobase-labs/passport-sdk';
