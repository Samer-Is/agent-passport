/**
 * Admin Routes - Portal administration endpoints
 * Protected by portal internal API key or session
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { config } from '../config/index.js';
import {
  registerApp,
  getApp,
  listApps,
  updateApp,
  deactivateApp,
  rotateAppKey,
  createAppKey,
  revokeAppKey,
} from '../services/app.js';
import {
  createPortalUser,
  authenticatePortalUser,
  getPortalUser,
  updatePortalUser,
  changePassword,
} from '../services/portal-user.js';

// Zod schemas for validation
const CreateAppSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allowedScopes: z.array(z.string()).optional(),
  allowedCallbackUrls: z.array(z.string().url()).optional(),
});

const UpdateAppSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  allowedScopes: z.array(z.string()).optional(),
  allowedCallbackUrls: z.array(z.string().url()).optional(),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(100).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const UpdateUserSchema = z.object({
  displayName: z.string().max(100).optional(),
  password: z.string().min(8).optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
});

// Type for authenticated request
interface AuthenticatedRequest extends FastifyRequest {
  portalUserId: string;
}

// Middleware to verify portal authentication
async function verifyPortalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check for internal API key (from portal backend)
  const apiKey = request.headers['x-portal-api-key'];
  const userId = request.headers['x-portal-user-id'];
  
  if (
    apiKey &&
    config.portalInternalApiKey &&
    apiKey === config.portalInternalApiKey &&
    userId
  ) {
    (request as AuthenticatedRequest).portalUserId = userId as string;
    return;
  }

  // If no valid auth, reject
  return reply.status(401).send({
    error: 'unauthorized',
    message: 'Portal authentication required',
  });
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Add auth hook for all admin routes
  fastify.addHook('preHandler', verifyPortalAuth);

  // ============ APP MANAGEMENT ============

  /**
   * POST /admin/apps - Register a new app
   */
  fastify.post('/apps', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;
    
    const parseResult = CreateAppSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      const result = await registerApp({
        ...parseResult.data,
        portalUserId: authRequest.portalUserId,
      });

      return reply.status(201).send({
        app: result.app,
        key: result.key,
        message: 'App created successfully. Save the API key - it will not be shown again.',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to register app');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to register app',
      });
    }
  });

  /**
   * GET /admin/apps - List all apps for the authenticated user
   */
  fastify.get('/apps', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    try {
      const apps = await listApps(authRequest.portalUserId);
      return reply.send({ apps });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to list apps');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to list apps',
      });
    }
  });

  /**
   * GET /admin/apps/:appId - Get app details
   */
  fastify.get<{ Params: { appId: string } }>(
    '/apps/:appId',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId } = request.params;

      try {
        const app = await getApp(appId);

        if (!app || app.portalUserId !== authRequest.portalUserId) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'App not found',
          });
        }

        return reply.send({ app });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get app');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to get app',
        });
      }
    }
  );

  /**
   * PATCH /admin/apps/:appId - Update app settings
   */
  fastify.patch<{ Params: { appId: string } }>(
    '/apps/:appId',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId } = request.params;

      const parseResult = UpdateAppSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'validation_error',
          details: parseResult.error.format(),
        });
      }

      try {
        const app = await updateApp(
          appId,
          authRequest.portalUserId,
          parseResult.data
        );

        if (!app) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'App not found',
          });
        }

        return reply.send({ app });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to update app');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to update app',
        });
      }
    }
  );

  /**
   * DELETE /admin/apps/:appId - Deactivate an app
   */
  fastify.delete<{ Params: { appId: string } }>(
    '/apps/:appId',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId } = request.params;

      try {
        const app = await deactivateApp(appId, authRequest.portalUserId);

        if (!app) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'App not found',
          });
        }

        return reply.send({
          message: 'App deactivated successfully',
          app: { id: app.id, status: app.status },
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to deactivate app');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to deactivate app',
        });
      }
    }
  );

  /**
   * POST /admin/apps/:appId/rotate-key - Rotate app API key
   */
  fastify.post<{ Params: { appId: string } }>(
    '/apps/:appId/rotate-key',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId } = request.params;

      try {
        const key = await rotateAppKey(appId, authRequest.portalUserId);

        if (!key) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'App not found',
          });
        }

        return reply.send({
          key,
          message: 'API key rotated. Save the new key - it will not be shown again.',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to rotate key');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to rotate key',
        });
      }
    }
  );

  /**
   * POST /admin/apps/:appId/keys - Create a new API key for an app
   */
  fastify.post<{ Params: { appId: string }; Body: { name?: string } }>(
    '/apps/:appId/keys',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId } = request.params;
      const { name } = request.body as { name?: string };

      try {
        const key = await createAppKey(appId, authRequest.portalUserId, name);

        if (!key) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'App not found',
          });
        }

        return reply.send({
          id: key.id,
          prefix: key.prefix,
          fullKey: key.fullKey,
          message: 'API key created. Save the key - it will not be shown again.',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create key');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to create key',
        });
      }
    }
  );

  /**
   * DELETE /admin/apps/:appId/keys/:keyId - Revoke an API key
   */
  fastify.delete<{ Params: { appId: string; keyId: string } }>(
    '/apps/:appId/keys/:keyId',
    async (request, reply) => {
      const authRequest = request as AuthenticatedRequest;
      const { appId, keyId } = request.params;

      try {
        const result = await revokeAppKey(keyId, appId, authRequest.portalUserId);

        if (!result) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'Key not found',
          });
        }

        return reply.send({
          message: 'API key revoked successfully',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to revoke key');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to revoke key',
        });
      }
    }
  );

  // ============ PORTAL USER MANAGEMENT ============

  /**
   * GET /admin/me - Get current portal user info
   */
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    try {
      const user = await getPortalUser(authRequest.portalUserId);

      if (!user) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'User not found',
        });
      }

      return reply.send({ user });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to get user');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to get user',
      });
    }
  });

  /**
   * PATCH /admin/me - Update current portal user
   */
  fastify.patch('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    const parseResult = UpdateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await updatePortalUser(
        authRequest.portalUserId,
        parseResult.data
      );

      return reply.send({ user });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to update user');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to update user',
      });
    }
  });

  /**
   * PATCH /admin/profile - Update current user's profile (displayName only)
   */
  fastify.patch('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    const parseResult = UpdateProfileSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await updatePortalUser(
        authRequest.portalUserId,
        parseResult.data
      );

      return reply.send({ user });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to update profile');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to update profile',
      });
    }
  });

  /**
   * POST /admin/password - Change current user's password
   */
  fastify.post('/password', async (request: FastifyRequest, reply: FastifyReply) => {
    const authRequest = request as AuthenticatedRequest;

    const parseResult = ChangePasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      await changePassword(
        authRequest.portalUserId,
        parseResult.data.currentPassword,
        parseResult.data.newPassword
      );

      return reply.send({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof Error && error.message.includes('incorrect')) {
        return reply.status(400).send({
          error: 'invalid_password',
          message: error.message,
        });
      }

      request.log.error({ err: error }, 'Failed to change password');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to change password',
      });
    }
  });
}

// ============ PUBLIC AUTH ROUTES (no auth required) ============

export async function authRoutes(fastify: FastifyInstance) {
  /**
   * POST /auth/register - Register a new portal user
   */
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await createPortalUser(parseResult.data);
      return reply.status(201).send({ user });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return reply.status(409).send({
          error: 'conflict',
          message: 'User with this email already exists',
        });
      }

      request.log.error({ err: error }, 'Failed to create user');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to create user',
      });
    }
  });

  /**
   * POST /auth/login - Authenticate a portal user
   */
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = LoginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parseResult.error.format(),
      });
    }

    try {
      const user = await authenticatePortalUser(
        parseResult.data.email,
        parseResult.data.password
      );

      if (!user) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid email or password',
        });
      }

      // Return user info - session management happens in portal
      return reply.send({ user });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to authenticate');
      return reply.status(500).send({
        error: 'internal_error',
        message: 'Failed to authenticate',
      });
    }
  });
}
