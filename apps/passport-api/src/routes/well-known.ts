/**
 * Well-Known Routes - JWKS and OpenID Configuration
 * These endpoints are public and used for key discovery
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPublicJwk } from '../services/jwt.js';

export async function wellKnownRoutes(fastify: FastifyInstance) {
  /**
   * GET /.well-known/jwks.json - JSON Web Key Set
   * 
   * Returns the public key(s) used to verify identity tokens.
   * Apps can use this to verify tokens without calling our API.
   */
  fastify.get('/.well-known/jwks.json', async (_request: FastifyRequest, reply: FastifyReply) => {
    const publicJwk = await getPublicJwk();

    return reply
      .header('Cache-Control', 'public, max-age=3600') // Cache for 1 hour
      .send({
        keys: [publicJwk],
      });
  });

  /**
   * GET /.well-known/openid-configuration - OpenID Connect Discovery
   * 
   * Returns metadata about the identity provider.
   * This follows the OpenID Connect Discovery spec.
   */
  fastify.get('/.well-known/openid-configuration', async (request: FastifyRequest, reply: FastifyReply) => {
    // Determine the issuer URL from the request
    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:3001';
    const issuer = `${protocol}://${host}`;

    return reply
      .header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours
      .send({
        issuer: 'agent-passport',
        authorization_endpoint: `${issuer}/v1/agents/challenge`,
        token_endpoint: `${issuer}/v1/agents/identity-token`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        introspection_endpoint: `${issuer}/v1/tokens/introspect`,
        
        // Supported features
        response_types_supported: ['token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['EdDSA'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
        
        // Claims
        claims_supported: [
          'sub',
          'handle',
          'scopes',
          'iss',
          'iat',
          'exp',
          'jti',
        ],
        
        // Agent Passport specific
        agent_passport_version: '1.0',
        documentation_url: 'https://github.com/your-org/agent-passport',
      });
  });
}
