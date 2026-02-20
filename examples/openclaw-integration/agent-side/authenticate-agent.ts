/**
 * authenticate-agent.ts — Full challenge-response authentication flow
 *
 * This script shows how an OpenClaw-style AI agent authenticates with
 * Agent Passport and receives a short-lived JWT identity token.
 *
 * The private key NEVER leaves this process — only a cryptographic
 * signature is sent to Agent Passport.
 *
 * Prerequisites:
 *   Run register-agent.ts first to create .agent-credentials.json
 *
 * Usage:
 *   npx tsx authenticate-agent.ts
 */

import { AgentClient } from '@zerobase-labs/passport-sdk';
import * as ed from '@noble/ed25519';
import { readFileSync } from 'node:fs';

async function main() {
  // 1. Load saved credentials
  let credentials: { agentId: string; privateKeyB64: string; passportUrl: string };
  try {
    credentials = JSON.parse(readFileSync('.agent-credentials.json', 'utf-8'));
  } catch {
    console.error('❌ No credentials found. Run register-agent.ts first.');
    process.exit(1);
  }

  const privateKey = Buffer.from(credentials.privateKeyB64, 'base64');

  console.log('🔐 Authenticating agent', credentials.agentId.slice(0, 8) + '...');

  // 2. Create SDK client
  const agent = new AgentClient({ baseUrl: credentials.passportUrl });

  // 3. Authenticate using challenge-response
  //    The SDK handles: request challenge → call your sign callback → exchange for token
  const { token, expiresAt } = await agent.authenticate({
    agentId: credentials.agentId,
    sign: async (nonce: string) => {
      // Sign the challenge nonce with our private key
      // The private key NEVER leaves this callback
      const signature = await ed.signAsync(
        new TextEncoder().encode(nonce),
        privateKey,
      );
      return Buffer.from(signature).toString('base64');
    },
  });

  console.log('');
  console.log('✅ Authentication successful!');
  console.log('   Token:     ', token.slice(0, 30) + '...');
  console.log('   Expires at:', expiresAt);
  console.log('');
  console.log('📤 Present this token to any app that uses Agent Passport.');
  console.log('   Example header: X-Agent-Token: ' + token.slice(0, 20) + '...');
}

main().catch((err) => {
  console.error('❌ Authentication failed:', err.message);
  process.exit(1);
});
