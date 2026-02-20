/**
 * @agent-passport/openclaw-plugin/fastify
 *
 * Fastify plugin for Agent Passport identity verification.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { agentPassportPlugin } from '@agent-passport/openclaw-plugin/fastify';
 *
 * const app = Fastify();
 *
 * await app.register(agentPassportPlugin, {
 *   baseUrl: 'https://agent-passport.onrender.com',
 *   appId: process.env.PASSPORT_APP_ID!,
 *   appKey: process.env.PASSPORT_APP_KEY!,
 * });
 *
 * // Now use the decorator on routes:
 * app.post('/skills/:id/execute', {
 *   preHandler: app.requireAgent,
 * }, async (request, reply) => {
 *   const { agentId, handle, risk } = request.verifiedAgent!;
 *   return { executed: true, by: handle };
 * });
 * ```
 */

import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginAsync,
} from 'fastify';
import { createVerifier, type PluginOptions, type VerifiedAgent } from './index.js';

// Augment Fastify
declare module 'fastify' {
  interface FastifyRequest {
    verifiedAgent?: VerifiedAgent;
  }
  interface FastifyInstance {
    requireAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAgent: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Fastify plugin that adds Agent Passport verification decorators.
 *
 * After registration, the Fastify instance has `requireAgent` and
 * `optionalAgent` preHandler hooks, and every request has a
 * `verifiedAgent` property.
 */
export const agentPassportPlugin: FastifyPluginAsync<PluginOptions> = async (
  fastify: FastifyInstance,
  options: PluginOptions,
) => {
  const tokenHeader = options.tokenHeader ?? 'x-agent-token';
  const verify = createVerifier(options);

  // Decorate requests with verifiedAgent
  fastify.decorateRequest('verifiedAgent', undefined);

  // requireAgent — blocks if no valid token
  fastify.decorate(
    'requireAgent',
    async function requireAgent(request: FastifyRequest, reply: FastifyReply) {
      const token = request.headers[tokenHeader] as string | undefined;
      const result = await verify(token);

      if (!result.verified) {
        reply.status(result.status).send({
          error: result.error,
          ...(result.reason && { reason: result.reason }),
          ...(result.risk && { risk: result.risk }),
        });
        return;
      }

      request.verifiedAgent = result.agent;

      if (result.agent.risk.action === 'throttle') {
        reply.header('X-Agent-Risk', 'throttled');
      }
    },
  );

  // optionalAgent — passes through if no token
  fastify.decorate(
    'optionalAgent',
    async function optionalAgent(request: FastifyRequest, _reply: FastifyReply) {
      const token = request.headers[tokenHeader] as string | undefined;
      if (!token) return;

      const result = await verify(token);
      if (result.verified) {
        request.verifiedAgent = result.agent;
      }
    },
  );
};

export { createVerifier, type PluginOptions, type VerifiedAgent } from './index.js';
