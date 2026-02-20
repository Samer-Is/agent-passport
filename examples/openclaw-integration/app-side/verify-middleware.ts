/**
 * verify-middleware.ts — Drop-in Express middleware for Agent Passport verification
 *
 * Verifies the agent's identity token on every request and attaches the
 * verified identity to `req.verifiedAgent`. Blocks unverified and high-risk agents.
 *
 * Usage:
 *   import { requireVerifiedAgent } from './verify-middleware';
 *   app.post('/protected', requireVerifiedAgent(), handler);
 */

import { AgentPassportClient } from '@zerobase-labs/passport-sdk';
import type { Request, Response, NextFunction } from 'express';

// Extend Express Request to include verified agent info
declare global {
  namespace Express {
    interface Request {
      verifiedAgent?: {
        agentId: string;
        handle: string | null;
        risk: { score: number; action: string; reasons: string[] };
      };
    }
  }
}

const passport = new AgentPassportClient({
  baseUrl: process.env.PASSPORT_URL ?? 'https://agent-passport.onrender.com',
  appId: process.env.PASSPORT_APP_ID!,
  appKey: process.env.PASSPORT_APP_KEY!,
});

/**
 * Express middleware that requires a verified agent identity token.
 *
 * Reads the token from the `X-Agent-Token` header, verifies it against
 * Agent Passport, and blocks unverified or high-risk agents.
 *
 * @param options.blockThreshold - Risk score threshold to block agents (default: uses risk engine recommendation)
 */
export function requireVerifiedAgent(options?: { blockThreshold?: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-agent-token'] as string | undefined;

    if (!token) {
      return res.status(401).json({ error: 'Missing agent token' });
    }

    try {
      const result = await passport.verify(token);

      if (!result.valid) {
        return res.status(401).json({
          error: 'Invalid agent identity',
          reason: result.reason,
        });
      }

      // Check risk assessment
      if (result.risk.action === 'block') {
        return res.status(403).json({
          error: 'Agent blocked by risk engine',
          risk: result.risk,
        });
      }

      if (result.risk.action === 'throttle') {
        // Signal to downstream handlers that this agent is throttled
        res.set('X-Agent-Risk', 'throttled');
      }

      // Attach verified agent info to request for downstream handlers
      req.verifiedAgent = {
        agentId: result.agentId,
        handle: result.handle ?? null,
        risk: result.risk,
      };

      next();
    } catch (err) {
      console.error('Agent verification error:', err);
      return res.status(502).json({ error: 'Identity verification service unavailable' });
    }
  };
}
