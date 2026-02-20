import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

const requestIdPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('requestId', '');

  fastify.addHook('onRequest', async (request) => {
    request.requestId = request.id;
  });

  // Add request_id to all responses
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-ID', request.requestId);
    return payload;
  });
};

export const requestIdPlugin = fp(requestIdPluginImpl, {
  name: 'request-id',
  fastify: '4.x',
});
