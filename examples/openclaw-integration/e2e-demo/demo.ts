/**
 * demo.ts — Full end-to-end demo of Agent Passport + OpenClaw skill gateway
 *
 * This script runs the entire flow:
 *   1. Generate Ed25519 keypair
 *   2. Register agent with Agent Passport
 *   3. Authenticate (challenge → sign → token)
 *   4. Start a local skill gateway server
 *   5. Call the skill gateway with the agent's identity token
 *   6. Show the verification result
 *
 * Prerequisites:
 *   - Agent Passport API running (local or deployed)
 *   - App credentials (PASSPORT_APP_ID, PASSPORT_APP_KEY)
 *
 * Usage:
 *   PASSPORT_URL=http://localhost:3000 \
 *   PASSPORT_APP_ID=your-app-id \
 *   PASSPORT_APP_KEY=your-app-key \
 *   npx tsx demo.ts
 */

import { AgentClient, AgentPassportClient } from '@zerobase-labs/passport-sdk';
import * as ed from '@noble/ed25519';
import express from 'express';

const PASSPORT_URL = process.env.PASSPORT_URL ?? 'https://agent-passport.onrender.com';
const APP_ID = process.env.PASSPORT_APP_ID;
const APP_KEY = process.env.PASSPORT_APP_KEY;

if (!APP_ID || !APP_KEY) {
  console.error('❌ Missing PASSPORT_APP_ID or PASSPORT_APP_KEY environment variables.');
  console.error('   Create an app in the Agent Passport Portal first.');
  process.exit(1);
}

function separator(title: string) {
  console.log('');
  console.log('─'.repeat(60));
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('🛂 Agent Passport — End-to-End Demo');
  console.log(`   API: ${PASSPORT_URL}`);

  // ── Step 1: Generate keypair ──────────────────────────────────────

  separator('Step 1: Generate Ed25519 Keypair');

  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const publicKeyB64 = Buffer.from(publicKey).toString('base64');

  console.log('✅ Keypair generated');
  console.log('   Public key:', publicKeyB64.slice(0, 30) + '...');

  // ── Step 2: Register agent ────────────────────────────────────────

  separator('Step 2: Register Agent');

  const agentClient = new AgentClient({ baseUrl: PASSPORT_URL });
  const registration = await agentClient.register({
    handle: `demo-agent-${Date.now()}`,
    publicKeyB64,
  });

  console.log('✅ Agent registered');
  console.log('   Agent ID:', registration.agentId);
  console.log('   Status:  ', registration.status);

  // ── Step 3: Authenticate (challenge → sign → token) ───────────────

  separator('Step 3: Authenticate');

  const auth = await agentClient.authenticate({
    agentId: registration.agentId,
    sign: async (nonce: string) => {
      console.log('   📝 Signing challenge (private key stays local)...');
      const signature = await ed.signAsync(
        new TextEncoder().encode(nonce),
        privateKey,
      );
      return Buffer.from(signature).toString('base64');
    },
  });

  console.log('✅ Authenticated');
  console.log('   Token:', auth.token.slice(0, 40) + '...');
  console.log('   Expires:', auth.expiresAt);

  // ── Step 4: Start skill gateway ───────────────────────────────────

  separator('Step 4: Start Skill Gateway');

  const passport = new AgentPassportClient({
    baseUrl: PASSPORT_URL,
    appId: APP_ID,
    appKey: APP_KEY,
  });

  const app = express();
  app.use(express.json());

  // Protected skill execution endpoint
  app.post('/skills/:skillId/execute', async (req, res) => {
    const token = req.headers['x-agent-token'] as string | undefined;

    if (!token) {
      return res.status(401).json({ error: 'Missing agent token' });
    }

    const result = await passport.verify(token);

    if (!result.valid) {
      return res.status(401).json({ error: 'Invalid agent', reason: result.reason });
    }

    if (result.risk.action === 'block') {
      return res.status(403).json({ error: 'Agent blocked', risk: result.risk });
    }

    res.json({
      success: true,
      skillId: req.params.skillId,
      executedBy: result.agentId,
      riskScore: result.risk.score,
      riskAction: result.risk.action,
    });
  });

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4000;
  console.log(`✅ Skill gateway running on http://localhost:${port}`);

  // ── Step 5: Call skill gateway with agent token ───────────────────

  separator('Step 5: Execute Skill as Verified Agent');

  const skillResponse = await fetch(`http://localhost:${port}/skills/web-search/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Token': auth.token,
    },
    body: JSON.stringify({ query: 'What is Agent Passport?' }),
  });

  const skillResult = await skillResponse.json();

  console.log('✅ Skill executed');
  console.log('   Result:', JSON.stringify(skillResult, null, 2));

  // ── Step 6: Show summary ──────────────────────────────────────────

  separator('Demo Complete!');

  console.log('Summary:');
  console.log('  1. Generated Ed25519 keypair (private key never left this process)');
  console.log('  2. Registered agent with Agent Passport');
  console.log('  3. Authenticated via challenge-response');
  console.log('  4. Started a skill gateway that verifies agent identities');
  console.log('  5. Called the gateway with our identity token');
  console.log('  6. Gateway verified our identity and allowed skill execution');
  console.log('');
  console.log('This is how you secure any agent ecosystem with Agent Passport. 🛂');

  server.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Demo failed:', err.message);
  process.exit(1);
});
