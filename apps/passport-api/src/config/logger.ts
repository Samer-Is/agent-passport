import type { FastifyBaseLogger, FastifyRequest, FastifyReply } from 'fastify';

export const loggerConfig: FastifyBaseLogger | boolean | object = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' 
    ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  serializers: {
    req(request: FastifyRequest) {
      return {
        method: request.method,
        url: request.url,
        requestId: request.id,
      };
    },
    res(reply: FastifyReply) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
};
