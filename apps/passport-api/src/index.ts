import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config/index.js';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { adminRoutes, authRoutes } from './routes/admin.js';
import { tokenRoutes } from './routes/tokens.js';
import { wellKnownRoutes } from './routes/well-known.js';
import { requestIdPlugin } from './plugins/request-id.js';
import { errorHandler } from './plugins/error-handler.js';
import { loggerConfig } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';

const app = Fastify({
  logger: loggerConfig,
  genReqId: () => crypto.randomUUID(),
});

async function bootstrap() {
  // Connect to databases
  await connectDatabase();
  await connectRedis();

  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsAllowedOrigins,
    credentials: true,
  });

  // Custom plugins
  await app.register(requestIdPlugin);
  app.setErrorHandler(errorHandler);

  // Routes
  await app.register(healthRoutes);
  await app.register(wellKnownRoutes); // JWKS and OpenID discovery
  await app.register(agentRoutes, { prefix: '/v1/agents' });
  await app.register(adminRoutes, { prefix: '/v1/admin' });
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(tokenRoutes, { prefix: '/v1/tokens' });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    await app.close();
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return app;
}

async function start() {
  try {
    const server = await bootstrap();
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Agent Passport API running on port ${config.port}`);
  } catch (err: unknown) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { bootstrap };
