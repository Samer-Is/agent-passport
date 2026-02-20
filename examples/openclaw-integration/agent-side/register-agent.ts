/**
 * register-agent.ts — Register an AI agent with Agent Passport
 *
 * This script shows how an OpenClaw-style AI agent registers its identity.
 * After registration, the agent receives an ID that it uses for all future
 * authentication flows.
 *
 * Usage:
 *   npx tsx register-agent.ts
 */

import { AgentClient } from '@zerobase-labs/passport-sdk';
import * as ed from '@noble/ed25519';
import { writeFileSync } from 'node:fs';

const PASSPORT_URL = process.env.PASSPORT_URL ?? 'https://agent-passport.onrender.com';

async function main() {
  console.log('🔑 Generating Ed25519 keypair...');

  // 1. Generate Ed25519 keypair
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  const privateKeyB64 = Buffer.from(privateKey).toString('base64');
  const publicKeyB64 = Buffer.from(publicKey).toString('base64');

  console.log('   Public key:', publicKeyB64.slice(0, 20) + '...');

  // 2. Register with Agent Passport
  console.log('📝 Registering agent with Agent Passport...');
  const agent = new AgentClient({ baseUrl: PASSPORT_URL });
  const result = await agent.register({
    handle: 'my-openclaw-agent',
    publicKeyB64,
  });

  console.log('');
  console.log('✅ Agent registered successfully!');
  console.log('   Agent ID:', result.agentId);
  console.log('   Status:  ', result.status);
  console.log('');

  // 3. Save credentials for later use
  const credentials = {
    agentId: result.agentId,
    publicKeyB64,
    privateKeyB64,
    passportUrl: PASSPORT_URL,
  };

  writeFileSync('.agent-credentials.json', JSON.stringify(credentials, null, 2));
  console.log('💾 Credentials saved to .agent-credentials.json');
  console.log('⚠️  Keep your private key secure — you need it to authenticate.');
  console.log('⚠️  Never commit .agent-credentials.json to version control.');
}

main().catch((err) => {
  console.error('❌ Registration failed:', err.message);
  process.exit(1);
});
