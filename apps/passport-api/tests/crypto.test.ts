import { describe, it, expect } from 'vitest';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { verifySignature, isValidPublicKey, generateNonce } from '../src/lib/crypto.js';

// Configure ed25519 for tests
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

describe('Crypto Utilities', () => {
  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      // Generate a keypair
      const privateKey = ed.utils.randomPrivateKey();
      const publicKey = await ed.getPublicKeyAsync(privateKey);
      
      const message = 'test-nonce-12345';
      const signature = await ed.signAsync(
        new TextEncoder().encode(message),
        privateKey
      );
      
      const publicKeyB64 = Buffer.from(publicKey).toString('base64');
      const signatureB64 = Buffer.from(signature).toString('base64');
      
      const result = await verifySignature(signatureB64, message, publicKeyB64);
      expect(result).toBe(true);
    });

    it('should reject an invalid signature', async () => {
      const privateKey = ed.utils.randomPrivateKey();
      const publicKey = await ed.getPublicKeyAsync(privateKey);
      
      const message = 'test-nonce-12345';
      const wrongMessage = 'wrong-message';
      const signature = await ed.signAsync(
        new TextEncoder().encode(wrongMessage),
        privateKey
      );
      
      const publicKeyB64 = Buffer.from(publicKey).toString('base64');
      const signatureB64 = Buffer.from(signature).toString('base64');
      
      const result = await verifySignature(signatureB64, message, publicKeyB64);
      expect(result).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const privateKey1 = ed.utils.randomPrivateKey();
      const privateKey2 = ed.utils.randomPrivateKey();
      const publicKey2 = await ed.getPublicKeyAsync(privateKey2);
      
      const message = 'test-nonce-12345';
      const signature = await ed.signAsync(
        new TextEncoder().encode(message),
        privateKey1
      );
      
      const publicKeyB64 = Buffer.from(publicKey2).toString('base64');
      const signatureB64 = Buffer.from(signature).toString('base64');
      
      const result = await verifySignature(signatureB64, message, publicKeyB64);
      expect(result).toBe(false);
    });

    it('should handle invalid base64 input gracefully', async () => {
      const result = await verifySignature('not-valid-base64!!!', 'message', 'also-invalid');
      expect(result).toBe(false);
    });

    it('should reject wrong key length', async () => {
      const result = await verifySignature(
        Buffer.from(new Uint8Array(64)).toString('base64'),
        'message',
        Buffer.from(new Uint8Array(16)).toString('base64') // wrong length
      );
      expect(result).toBe(false);
    });
  });

  describe('isValidPublicKey', () => {
    it('should accept valid 32-byte public key', async () => {
      const privateKey = ed.utils.randomPrivateKey();
      const publicKey = await ed.getPublicKeyAsync(privateKey);
      const publicKeyB64 = Buffer.from(publicKey).toString('base64');
      
      expect(isValidPublicKey(publicKeyB64)).toBe(true);
    });

    it('should reject keys with wrong length', () => {
      const wrongLength = Buffer.from(new Uint8Array(16)).toString('base64');
      expect(isValidPublicKey(wrongLength)).toBe(false);
    });

    it('should reject invalid base64', () => {
      expect(isValidPublicKey('not-valid!!!')).toBe(false);
    });
  });

  describe('generateNonce', () => {
    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      
      expect(nonce1).not.toBe(nonce2);
    });

    it('should generate base64 encoded strings', () => {
      const nonce = generateNonce();
      
      // Should be valid base64
      expect(() => Buffer.from(nonce, 'base64')).not.toThrow();
    });

    it('should respect length parameter', () => {
      const nonce16 = generateNonce(16);
      const nonce32 = generateNonce(32);
      
      // Base64 encoding increases size by ~33%
      expect(Buffer.from(nonce16, 'base64').length).toBe(16);
      expect(Buffer.from(nonce32, 'base64').length).toBe(32);
    });
  });
});
