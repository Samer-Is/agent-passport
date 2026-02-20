import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// Configure ed25519 to use sha512
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

/**
 * Verify an Ed25519 signature
 * @param signatureB64 - Base64 encoded signature (64 bytes)
 * @param message - The message that was signed (as string or bytes)
 * @param publicKeyB64 - Base64 encoded public key (32 bytes)
 * @returns true if signature is valid
 */
export async function verifySignature(
  signatureB64: string,
  message: string | Uint8Array,
  publicKeyB64: string
): Promise<boolean> {
  try {
    const signature = Buffer.from(signatureB64, 'base64');
    const publicKey = Buffer.from(publicKeyB64, 'base64');
    
    // Validate key/signature lengths
    if (publicKey.length !== 32) {
      return false;
    }
    if (signature.length !== 64) {
      return false;
    }
    
    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;
    
    return await ed.verifyAsync(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Validate that a base64 string is a valid Ed25519 public key
 */
export function isValidPublicKey(publicKeyB64: string): boolean {
  try {
    const publicKey = Buffer.from(publicKeyB64, 'base64');
    return publicKey.length === 32;
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random nonce
 */
export function generateNonce(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Buffer.from(bytes).toString('base64');
}

/**
 * Generate a random UUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
