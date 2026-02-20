/**
 * Risk Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { computeRisk, RiskSignals } from '../src/services/risk-engine.js';

describe('Risk Engine', () => {
  describe('computeRisk', () => {
    it('should return block for suspended agent', async () => {
      const signals: RiskSignals = {
        agentId: 'test-agent-1',
        agentStatus: 'suspended',
        agentCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };

      const result = await computeRisk(signals);

      expect(result.score).toBe(100);
      expect(result.recommendedAction).toBe('block');
      expect(result.reasons).toContain('agent_suspended');
    });

    it('should add score for new agent (< 7 days)', async () => {
      const signals: RiskSignals = {
        agentId: 'test-agent-2',
        agentStatus: 'active',
        agentCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      };

      const result = await computeRisk(signals);

      expect(result.score).toBeGreaterThanOrEqual(25);
      expect(result.reasons).toContain('new_agent');
    });

    it('should return allow for old active agent with no issues', async () => {
      const signals: RiskSignals = {
        agentId: 'test-agent-3',
        agentStatus: 'active',
        agentCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      };

      const result = await computeRisk(signals);

      // Without Redis data, only age-based scoring applies
      expect(result.score).toBeLessThan(30);
      expect(result.recommendedAction).toBe('allow');
    });

    it('should clamp score between 0 and 100', async () => {
      const signals: RiskSignals = {
        agentId: 'test-agent-4',
        agentStatus: 'suspended',
        agentCreatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (new)
      };

      const result = await computeRisk(signals);

      // Suspended immediately returns 100
      expect(result.score).toBe(100);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should map scores to correct actions', async () => {
      // Test allow range (0-29)
      const allowSignals: RiskSignals = {
        agentId: 'test-allow',
        agentStatus: 'active',
        agentCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      };
      const allowResult = await computeRisk(allowSignals);
      expect(allowResult.recommendedAction).toBe('allow');

      // Test block for suspended
      const blockSignals: RiskSignals = {
        agentId: 'test-block',
        agentStatus: 'suspended',
        agentCreatedAt: new Date(),
      };
      const blockResult = await computeRisk(blockSignals);
      expect(blockResult.recommendedAction).toBe('block');
    });
  });
});
