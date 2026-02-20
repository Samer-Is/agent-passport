/**
 * Sign a challenge nonce with an Ed25519 private key
 * 
 * Usage: pnpm tsx scripts/sign-challenge.ts <nonce> <privateKeyB64>
 * 
 * Example:
 *   pnpm tsx scripts/sign-challenge.ts "abc123nonce" "yourPrivateKeyBase64..."
 */

import * as ed from '@noble/ed25519';

async function main() {
  const [nonce, privateKeyB64] = process.argv.slice(2);
  
  if (!nonce || !privateKeyB64) {
    console.error('Usage: pnpm tsx scripts/sign-challenge.ts <nonce> <privateKeyB64>');
    process.exit(1);
  }
  
  // Decode private key from base64
  const privateKey = Buffer.from(privateKeyB64, 'base64');
  
  // Convert nonce to bytes
  const message = new TextEncoder().encode(nonce);
  
  // Sign the nonce
  const signature = await ed.signAsync(message, privateKey);
  
  // Convert signature to base64
  const signatureB64 = Buffer.from(signature).toString('base64');
  
  console.log('\n✅ Signature Generated\n');
  console.log('Nonce:', nonce);
  console.log('\nSignature (base64):');
  console.log(signatureB64);
  console.log('\n');
}

main().catch(console.error);
