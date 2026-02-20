import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/healthz', async (_request, reply) => {
    const checks: Record<string, boolean> = {
      api: true,
      database: false,
      redis: false,
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (err: unknown) {
      fastify.log.error({ err }, 'Database health check failed');
    }

    // Check Redis
    try {
      await redis.ping();
      checks.redis = true;
    } catch (err: unknown) {
      fastify.log.error({ err }, 'Redis health check failed');
    }

    const allHealthy = Object.values(checks).every(Boolean);
    const statusCode = allHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      ok: allHealthy,
      checks,
      timestamp: new Date().toISOString(),
    });
  });
};
