/**
 * skill-gateway.ts — Example skill marketplace that requires verified agents
 *
 * This demonstrates an OpenClaw-style skill marketplace where:
 * - Anyone can browse available skills (public)
 * - Only verified agents can execute skills (protected)
 * - High-risk agents are blocked from sensitive skills
 *
 * Usage:
 *   PASSPORT_APP_ID=... PASSPORT_APP_KEY=... npx tsx skill-gateway.ts
 */

import express from 'express';
import { requireVerifiedAgent } from './verify-middleware.js';

const app = express();
app.use(express.json());

// ── Public endpoint: List available skills ──────────────────────────

app.get('/skills', (_req, res) => {
  res.json({
    skills: [
      { id: 'web-search', name: 'Web Search', risk: 'low' },
      { id: 'calendar', name: 'Calendar Access', risk: 'low' },
      { id: 'email-send', name: 'Send Email', risk: 'high' },
      { id: 'payment', name: 'Process Payment', risk: 'high' },
    ],
  });
});

// ── Protected endpoint: Execute a skill (requires verified agent) ───

app.post('/skills/:skillId/execute', requireVerifiedAgent(), (req, res) => {
  const { agentId, handle, risk } = req.verifiedAgent!;
  const { skillId } = req.params;

  console.log(`🤖 Agent ${handle ?? agentId} executing skill: ${skillId}`);
  console.log(`   Risk score: ${risk.score}, action: ${risk.action}`);

  // Block high-risk agents from sensitive skills
  const sensitiveSkills = ['email-send', 'payment'];
  if (sensitiveSkills.includes(skillId) && risk.score > 30) {
    return res.status(403).json({
      error: 'Skill requires low-risk agent',
      skillId,
      risk,
    });
  }

  // Execute the skill (placeholder logic)
  res.json({
    result: 'Skill executed successfully',
    skillId,
    executedBy: handle ?? agentId,
    riskScore: risk.score,
  });
});

// ── Protected endpoint: Revoke an agent's token ─────────────────────

app.post('/agents/logout', requireVerifiedAgent(), async (req, res) => {
  // Example: an app can revoke the agent's token to end its session
  const token = req.headers['x-agent-token'] as string;
  console.log(`🔒 Agent ${req.verifiedAgent!.agentId} requesting logout`);

  // The app would call passport.revoke(token) here using the SDK
  res.json({ message: 'Logout acknowledged. Token should be revoked by the app.' });
});

// ── Start server ────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '4000', 10);

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Skill Gateway running on http://localhost:' + PORT);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /skills                    — List available skills (public)');
  console.log('  POST /skills/:skillId/execute   — Execute a skill (requires verified agent)');
  console.log('  POST /agents/logout             — End agent session (requires verified agent)');
  console.log('');
  console.log('Required headers for protected endpoints:');
  console.log('  X-Agent-Token: <jwt-identity-token>');
  console.log('');
});
