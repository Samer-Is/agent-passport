/**
 * @agent-passport/openclaw-plugin/express
 *
 * Drop-in Express middleware for Agent Passport identity verification.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { agentPassport } from '@agent-passport/openclaw-plugin/express';
 *
 * const app = express();
 *
 * const passport = agentPassport({
 *   baseUrl: 'https://agent-passport.onrender.com',
 *   appId: process.env.PASSPORT_APP_ID!,
 *   appKey: process.env.PASSPORT_APP_KEY!,
 * });
 *
 * // Protect specific routes
 * app.post('/skills/:id/execute', passport.requireAgent(), (req, res) => {
 *   const { agentId, handle, risk } = req.verifiedAgent!;
 *   res.json({ executed: true, by: handle });
 * });
 *
 * // Or protect all routes
 * app.use('/protected', passport.requireAgent());
 * ```
 */

import type { Request, Response, NextFunction } from 'express';
import { createVerifier, type PluginOptions, type VerifiedAgent } from './index.js';

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      verifiedAgent?: VerifiedAgent;
    }
  }
}

export interface ExpressPassport {
  /**
   * Middleware that requires a verified agent identity token.
   * Reads token from the configured header (default: `x-agent-token`).
   * On success, attaches `req.verifiedAgent`.
   * On failure, responds with 401/403.
   */
  requireAgent: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;

  /**
   * Middleware that *optionally* verifies an agent identity token.
   * If a token is present, it's verified and `req.verifiedAgent` is set.
   * If no token is present, the request proceeds without verification.
   * Useful for routes that work differently for verified vs. anonymous agents.
   */
  optionalAgent: () => (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

/**
 * Creates an Express middleware instance for Agent Passport verification.
 */
export function agentPassport(options: PluginOptions): ExpressPassport {
  const tokenHeader = options.tokenHeader ?? 'x-agent-token';
  const verify = createVerifier(options);

  return {
    requireAgent() {
      return async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers[tokenHeader] as string | undefined;
        const result = await verify(token);

        if (!result.verified) {
          res.status(result.status).json({
            error: result.error,
            ...(result.reason && { reason: result.reason }),
            ...(result.risk && { risk: result.risk }),
          });
          return;
        }

        req.verifiedAgent = result.agent;

        // Signal throttled agents via response header
        if (result.agent.risk.action === 'throttle') {
          res.set('X-Agent-Risk', 'throttled');
        }

        next();
      };
    },

    optionalAgent() {
      return async (req: Request, res: Response, next: NextFunction) => {
        const token = req.headers[tokenHeader] as string | undefined;

        if (!token) {
          next();
          return;
        }

        const result = await verify(token);
        if (result.verified) {
          req.verifiedAgent = result.agent;
        }

        next();
      };
    },
  };
}

export { createVerifier, type PluginOptions, type VerifiedAgent } from './index.js';
