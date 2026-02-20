import { SignJWT, jwtVerify, importJWK, type JWTPayload, type KeyLike } from 'jose';
import { config } from '../config/index.js';
import { JWT_ISSUER } from '@agent-passport/shared';

// Cached signing key
let signingKey: KeyLike | null = null;

/**
 * Get the signing key from environment (cached)
 */
async function getSigningKey(): Promise<KeyLike> {
  if (signingKey) {
    return signingKey;
  }
  
  const jwk = JSON.parse(config.jwtSigningJwk);
  signingKey = await importJWK(jwk, 'EdDSA') as KeyLike;
  return signingKey;
}

export interface TokenClaims {
  sub: string;       // agentId
  handle: string;    // agent handle
  scopes: string[];  // requested scopes
  jti: string;       // unique token ID
  iat: number;       // issued at
  exp: number;       // expiration
}

export interface CreateTokenParams {
  agentId: string;
  handle: string;
  scopes?: string[];
}

/**
 * Create a signed JWT identity token for an agent
 */
export async function createIdentityToken(params: CreateTokenParams): Promise<{
  token: string;
  expiresAt: Date;
  jti: string;
}> {
  const { agentId, handle, scopes = [] } = params;
  
  const key = await getSigningKey();
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (config.tokenTtlMinutes * 60);
  
  const token = await new SignJWT({
    handle,
    scopes,
  })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setIssuer(JWT_ISSUER)
    .setSubject(agentId)
    .setJti(jti)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  
  return {
    token,
    expiresAt: new Date(exp * 1000),
    jti,
  };
}

export interface VerifyTokenResult {
  valid: true;
  payload: TokenClaims;
}

export interface VerifyTokenError {
  valid: false;
  reason: string;
}

/**
 * Verify a JWT identity token
 */
export async function verifyIdentityToken(
  token: string
): Promise<VerifyTokenResult | VerifyTokenError> {
  try {
    const key = await getSigningKey();
    
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      algorithms: ['EdDSA'],
    });
    
    // Validate required claims
    if (!payload.sub || typeof payload.sub !== 'string') {
      return { valid: false, reason: 'missing_subject' };
    }
    if (!payload.jti || typeof payload.jti !== 'string') {
      return { valid: false, reason: 'missing_jti' };
    }
    if (!payload.handle || typeof payload.handle !== 'string') {
      return { valid: false, reason: 'missing_handle' };
    }
    
    const claims: TokenClaims = {
      sub: payload.sub,
      handle: payload.handle as string,
      scopes: (payload.scopes as string[]) ?? [],
      jti: payload.jti,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
    };
    
    return { valid: true, payload: claims };
  } catch (err: unknown) {
    const error = err as Error;
    
    if (error.message.includes('expired')) {
      return { valid: false, reason: 'token_expired' };
    }
    if (error.message.includes('signature')) {
      return { valid: false, reason: 'invalid_signature' };
    }
    if (error.message.includes('issuer')) {
      return { valid: false, reason: 'invalid_issuer' };
    }
    
    return { valid: false, reason: 'invalid_token' };
  }
}

/**
 * Extract claims from a token without verification (for logging/debugging)
 * WARNING: Do not trust these claims for authorization!
 */
export function decodeTokenUnsafe(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return payload;
  } catch {
    return null;
  }
}

// Cached public JWK
let publicJwkCache: object | null = null;

/**
 * Get the public JWK for JWKS endpoint
 */
export async function getPublicJwk(): Promise<object> {
  if (publicJwkCache) {
    return publicJwkCache;
  }

  const jwk = JSON.parse(config.jwtSigningJwk);
  
  // Create public JWK by removing private key component
  publicJwkCache = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    // Include key ID and usage
    kid: jwk.kid || 'agent-passport-key-1',
    use: 'sig',
    alg: 'EdDSA',
  };

  return publicJwkCache;
}
