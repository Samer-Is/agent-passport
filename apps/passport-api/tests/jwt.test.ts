import { describe, it, expect } from 'vitest';
import { createIdentityToken, verifyIdentityToken, decodeTokenUnsafe } from '../src/services/jwt.js';

describe('JWT Service', () => {
  describe('createIdentityToken', () => {
    it('should create a valid JWT token', async () => {
      const result = await createIdentityToken({
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        handle: 'test-agent',
        scopes: ['read', 'write'],
      });

      expect(result.token).toBeDefined();
      expect(result.token.split('.').length).toBe(3); // JWT has 3 parts
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.jti).toBeDefined();
    });

    it('should set correct expiration time', async () => {
      const beforeCreate = Date.now();
      
      const result = await createIdentityToken({
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        handle: 'test-agent',
      });

      const afterCreate = Date.now();
      const ttlMs = 60 * 60 * 1000; // 60 minutes
      const tolerance = 1000; // 1 second tolerance for timing
      
      const expectedExpMin = beforeCreate + ttlMs - tolerance;
      const expectedExpMax = afterCreate + ttlMs + tolerance;

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpMin);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpMax);
    });

    it('should include correct claims', async () => {
      const agentId = '123e4567-e89b-12d3-a456-426614174000';
      const handle = 'my-test-agent';
      const scopes = ['scope1', 'scope2'];

      const result = await createIdentityToken({ agentId, handle, scopes });
      const decoded = decodeTokenUnsafe(result.token);

      expect(decoded?.sub).toBe(agentId);
      expect(decoded?.handle).toBe(handle);
      expect(decoded?.scopes).toEqual(scopes);
      expect(decoded?.iss).toBe('agent-passport');
      expect(decoded?.jti).toBe(result.jti);
    });
  });

  describe('verifyIdentityToken', () => {
    it('should verify a valid token', async () => {
      const { token } = await createIdentityToken({
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        handle: 'test-agent',
        scopes: ['read'],
      });

      const result = await verifyIdentityToken(token);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.sub).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.payload.handle).toBe('test-agent');
        expect(result.payload.scopes).toEqual(['read']);
      }
    });

    it('should reject tampered tokens', async () => {
      const { token } = await createIdentityToken({
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        handle: 'test-agent',
      });

      // Tamper with the token
      const parts = token.split('.');
      parts[1] = Buffer.from(JSON.stringify({ sub: 'hacked' })).toString('base64url');
      const tamperedToken = parts.join('.');

      const result = await verifyIdentityToken(tamperedToken);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid tokens', async () => {
      const result = await verifyIdentityToken('not.a.valid.token');

      expect(result.valid).toBe(false);
    });

    it('should reject empty tokens', async () => {
      const result = await verifyIdentityToken('');

      expect(result.valid).toBe(false);
    });
  });

  describe('decodeTokenUnsafe', () => {
    it('should decode token payload without verification', async () => {
      const { token } = await createIdentityToken({
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        handle: 'test-agent',
      });

      const decoded = decodeTokenUnsafe(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return null for invalid tokens', () => {
      expect(decodeTokenUnsafe('invalid')).toBeNull();
      expect(decodeTokenUnsafe('')).toBeNull();
      expect(decodeTokenUnsafe('a.b')).toBeNull();
    });
  });
});
