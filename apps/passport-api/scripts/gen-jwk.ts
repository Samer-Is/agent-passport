/**
 * Generate a JWK (JSON Web Key) for JWT signing
 * 
 * Usage: pnpm tsx scripts/gen-jwk.ts
 * 
 * This outputs a JWK JSON string to use as JWT_SIGNING_JWK_JSON env var
 */

import { generateKeyPair, exportJWK } from 'jose';

async function main() {
  // Generate Ed25519 keypair
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
  });
  
  // Export as JWK (includes both public and private parts)
  const jwk = await exportJWK(privateKey);
  
  // Also get public-only JWK for reference
  const publicJwk = await exportJWK(publicKey);
  
  console.log('\n🔑 JWK Generated for JWT Signing\n');
  console.log('Set this as JWT_SIGNING_JWK_JSON environment variable:');
  console.log('\n' + JSON.stringify(jwk));
  console.log('\n\nPublic JWK (for token verification, if needed):');
  console.log(JSON.stringify(publicJwk));
  console.log('\n');
}

main().catch(console.error);
