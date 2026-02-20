/**
 * Generate an Ed25519 keypair for an agent
 * 
 * Usage: pnpm tsx scripts/gen-agent-keypair.ts
 * 
 * This outputs:
 * - publicKeyB64: Share this with Agent Passport when registering
 * - privateKeyB64: Keep this SECRET! Use it to sign challenges
 */

import * as ed from '@noble/ed25519';

async function main() {
  // Generate random private key (32 bytes)
  const privateKey = ed.utils.randomPrivateKey();
  
  // Derive public key
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  
  // Convert to base64
  const privateKeyB64 = Buffer.from(privateKey).toString('base64');
  const publicKeyB64 = Buffer.from(publicKey).toString('base64');
  
  console.log('\n🔐 Ed25519 Keypair Generated\n');
  console.log('Public Key (share with Agent Passport):');
  console.log(publicKeyB64);
  console.log('\n⚠️  Private Key (KEEP SECRET - never share):');
  console.log(privateKeyB64);
  console.log('\n');
}

main().catch(console.error);
