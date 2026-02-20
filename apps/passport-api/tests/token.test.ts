import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyToken, introspectToken } from '../src/services/token.js';
import { createIdentityToken } from '../src/services/jwt.js';
import { prisma } from '../src/lib/prisma.js';

// Mock Prisma
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    agent: {
      findUnique: vi.fn(),
    },
    verificationEvent: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('Token Service', () => {
  const mockAppId = '123e4567-e89b-12d3-a456-426614174001';
  const mockAgentId = '123e4567-e89b-12d3-a456-426614174000';
  const mockHandle = 'test-agent';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should verify a valid token with active agent', async () => {
      // Create a valid token
      const { token } = await createIdentityToken({
        agentId: mockAgentId,
        handle: mockHandle,
        scopes: ['read', 'write'],
      });

      // Mock agent lookup
      vi.mocked(prisma.agent.findUnique).mockResolvedValue({
        id: mockAgentId,
        handle: mockHandle,
        status: 'active',
        createdAt: new Date(),
      });

      const result = await verifyToken(token, mockAppId);

      expect(result.valid).toBe(true);
      expect(result.agentId).toBe(mockAgentId);
      expect(result.handle).toBe(mockHandle);
      expect(result.scopes).toEqual(['read', 'write']);
    });

    it('should reject invalid token', async () => {
      const result = await verifyToken('invalid.token.here', mockAppId);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('token_invalid');
    });

    it('should reject token for non-existent agent', async () => {
      const { token } = await createIdentityToken({
        agentId: mockAgentId,
        handle: mockHandle,
      });

      vi.mocked(prisma.agent.findUnique).mockResolvedValue(null);

      const result = await verifyToken(token, mockAppId);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('agent_not_found');
    });

    it('should reject token for suspended agent', async () => {
      const { token } = await createIdentityToken({
        agentId: mockAgentId,
        handle: mockHandle,
      });

      vi.mocked(prisma.agent.findUnique).mockResolvedValue({
        id: mockAgentId,
        handle: mockHandle,
        status: 'suspended',
        createdAt: new Date(),
      });

      const result = await verifyToken(token, mockAppId);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('agent_suspended');
    });
  });

  describe('introspectToken', () => {
    it('should return active=true for valid token with active agent', async () => {
      const { token, jti } = await createIdentityToken({
        agentId: mockAgentId,
        handle: mockHandle,
        scopes: ['read'],
      });

      vi.mocked(prisma.agent.findUnique).mockResolvedValue({
        id: mockAgentId,
        handle: mockHandle,
        status: 'active',
        createdAt: new Date(),
      });

      const result = await introspectToken(token, mockAppId);

      expect(result.active).toBe(true);
      expect(result.sub).toBe(mockAgentId);
      expect(result.handle).toBe(mockHandle);
      expect(result.scopes).toEqual(['read']);
      expect(result.jti).toBe(jti);
      expect(result.client_id).toBe(mockAppId);
    });

    it('should return active=false for invalid token', async () => {
      const result = await introspectToken('invalid.token', mockAppId);

      expect(result.active).toBe(false);
      expect(result.sub).toBeUndefined();
    });

    it('should return active=false for suspended agent', async () => {
      const { token } = await createIdentityToken({
        agentId: mockAgentId,
        handle: mockHandle,
      });

      vi.mocked(prisma.agent.findUnique).mockResolvedValue({
        id: mockAgentId,
        handle: mockHandle,
        status: 'suspended',
        createdAt: new Date(),
      });

      const result = await introspectToken(token, mockAppId);

      expect(result.active).toBe(false);
    });
  });
});
