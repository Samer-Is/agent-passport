import { describe, it, expect } from 'vitest';
import { registerAgentRequestSchema, handleSchema } from '../src/schemas/index.js';

describe('Schemas', () => {
  describe('handleSchema', () => {
    it('should accept valid handles', () => {
      expect(() => handleSchema.parse('my-agent')).not.toThrow();
      expect(() => handleSchema.parse('agent_123')).not.toThrow();
      expect(() => handleSchema.parse('abc')).not.toThrow();
    });

    it('should reject invalid handles', () => {
      expect(() => handleSchema.parse('ab')).toThrow(); // too short
      expect(() => handleSchema.parse('My-Agent')).toThrow(); // uppercase
      expect(() => handleSchema.parse('my agent')).toThrow(); // space
    });
  });

  describe('registerAgentRequestSchema', () => {
    it('should validate a valid registration request', () => {
      const validRequest = {
        handle: 'my-agent',
        publicKeyB64: 'MCowBQYDK2VwAyEAc3h5bW9ycGhpc21zYXJlYWxsb3dlZA==',
      };
      expect(() => registerAgentRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should reject invalid requests', () => {
      expect(() => registerAgentRequestSchema.parse({})).toThrow();
      expect(() =>
        registerAgentRequestSchema.parse({
          handle: 'ab', // too short
          publicKeyB64: 'valid-base64',
        })
      ).toThrow();
    });
  });
});
