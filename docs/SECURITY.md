# Agent Passport Security Documentation

> Threat model, replay protection, key rotation, and security best practices.

## Overview

Agent Passport is designed with security-first principles to provide a robust identity layer for AI agents. This document covers the security architecture, threat model, and mitigation strategies.

## Security Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Security Layers                             │
├─────────────────┬──────────────────┬──────────────────────────┤
│   Cryptography  │    Protocol      │       Operational        │
├─────────────────┼──────────────────┼──────────────────────────┤
│ Ed25519 (EdDSA) │ Challenge-Response│ Rate Limiting           │
│ JWT/JWS         │ Short-lived Tokens│ Risk Scoring            │
│ Argon2id        │ Nonce Expiration │ Audit Logging           │
│ HTTPS/TLS       │ One-time Use     │ Key Rotation Support    │
└─────────────────┴──────────────────┴──────────────────────────┘
```

## Cryptographic Choices

### Ed25519 for Agent Signatures

**Why Ed25519?**
- Fast signature generation and verification
- Small keys (32 bytes public, 32 bytes private)
- Deterministic signatures (no random number generator issues)
- Strong security (128-bit security level)
- Widely supported in modern cryptographic libraries

**Implementation:**
```typescript
// Agent keypair generation
import * as ed25519 from '@noble/ed25519';

const privateKey = ed25519.utils.randomPrivateKey();
const publicKey = await ed25519.getPublicKey(privateKey);
```

### JWT with EdDSA for Identity Tokens

**Why EdDSA?**
- Consistent with Ed25519 agent keys
- Faster than RSA for signature operations
- Compact tokens (smaller than RS256)
- No padding oracle attacks

**Token Structure:**
```json
{
  "alg": "EdDSA",
  "typ": "JWT"
}
{
  "sub": "agent-id",
  "iss": "agent-passport",
  "iat": 1738411200,
  "exp": 1738412100,
  "agent_name": "Agent Name",
  "public_key": "base64-public-key"
}
```

### Argon2id for Password/Key Hashing

**Why Argon2id?**
- Winner of the Password Hashing Competition
- Memory-hard (resistant to GPU/ASIC attacks)
- Hybrid construction (resistant to side-channel and GPU attacks)
- Configurable parameters for security/performance trade-off

**Parameters:**
```typescript
// App key hashing
const hash = await argon2.hash(appKey, {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,        // 3 iterations
  parallelism: 4      // 4 parallel threads
});
```

## Threat Model

### Assets Protected

1. **Agent Identity** - The cryptographic proof that an agent is who they claim
2. **Agent Private Keys** - Never transmitted; only signatures are sent
3. **App Secret Keys** - Hashed with Argon2id; never stored in plaintext
4. **Identity Tokens** - Short-lived JWTs that prove authentication

### Threat Actors

| Actor | Capability | Goal |
|-------|------------|------|
| Impersonator | Can create agents, has no private keys | Impersonate existing agents |
| Network Attacker | Can intercept traffic | Steal tokens, replay attacks |
| Malicious Agent | Has valid keys | Abuse apps, avoid detection |
| Insider Threat | Database access | Extract credentials |

### Attack Vectors and Mitigations

#### 1. Agent Impersonation

**Threat:** Attacker tries to authenticate as another agent.

**Mitigation:**
- Ed25519 signatures require the private key
- Challenge-response prevents replay
- Nonces are single-use and expire in 5 minutes

**Attack Resistance:**
```
Challenge: abc123...
Attacker without private key → Cannot produce valid signature
Attacker with stolen signature → Nonce already consumed
```

#### 2. Token Replay Attack

**Threat:** Attacker captures a token and replays it.

**Mitigations:**
- Tokens expire in 60 minutes
- Each verification is logged with timestamp
- Risk engine tracks verification patterns
- Apps can implement additional nonce checks

**Example Detection:**
```typescript
// Risk engine detects rapid re-use
if (verificationsInLastMinute > 100) {
  riskScore += 15; // burst_activity
}
```

#### 3. Challenge Replay Attack

**Threat:** Attacker captures a signed challenge and replays it.

**Mitigations:**
- Challenges expire in 5 minutes
- Challenges are single-use (deleted after successful verification)
- Challenges are bound to specific agent IDs
- Database constraint prevents reuse

#### 4. Signature Malleability

**Threat:** Attacker modifies signature without invalidating it.

**Mitigation:**
- Ed25519 signatures are non-malleable by design
- We use strict verification (reject non-canonical signatures)

#### 5. Private Key Theft

**Threat:** Agent's private key is compromised.

**Mitigations:**
- Agents should store keys securely (environment variables, secret managers)
- Key rotation support (agents can register new public keys)
- Risk engine can detect unusual patterns after compromise
- Admins can suspend compromised agents

**Recovery:**
1. Suspend the compromised agent via Portal
2. Agent generates new keypair
3. Agent re-registers with new public key
4. Update agent ID in app configurations

#### 6. App Key Theft

**Threat:** App's secret key is compromised.

**Mitigations:**
- Keys are hashed with Argon2id (cannot be recovered from database)
- Apps can rotate keys via Portal
- Old keys can be revoked

**Recovery:**
1. Revoke compromised key in Portal
2. Generate new key
3. Update app configuration

#### 7. Database Breach

**Threat:** Attacker gains access to database.

**Impact Analysis:**
| Data | Storage | Risk |
|------|---------|------|
| Agent public keys | Plaintext | Low (public by design) |
| Agent private keys | Not stored | None |
| App keys | Argon2id hash | Low (computationally infeasible to reverse) |
| JWT signing key | JWK format | Medium (token forgery if stolen) |
| Challenge nonces | Plaintext | Low (short-lived) |

**Mitigations:**
- Encrypt database at rest
- Use secure connection strings
- Rotate JWT signing keys periodically
- Monitor for unusual access patterns

#### 8. Denial of Service

**Threat:** Attacker overwhelms the API.

**Mitigations:**
- Rate limiting per agent, IP, and app
- Sliding window algorithm prevents burst attacks
- Risk scoring throttles suspicious agents
- Render provides DDoS protection at network level

**Rate Limits:**
| Endpoint | Limit | Window |
|----------|-------|--------|
| Challenge | 60/agent | 1 minute |
| Identity Token | 30/agent | 1 minute |
| Verify | 600/app | 1 minute |

## Token Revocation

Agent Passport supports revoking JWT tokens before they expire via a Redis blocklist.

### How It Works

1. An app calls `POST /v1/tokens/revoke` with the token to revoke
2. The token's JTI (JWT ID) is extracted and added to Redis with a TTL matching the token's remaining lifetime
3. On every `POST /v1/tokens/verify` call, the blocklist is checked after signature verification
4. Revoked tokens return `{ valid: false, reason: "token_revoked" }`
5. Blocklist entries auto-expire when the token would have expired naturally — no manual cleanup needed

### Graceful Degradation

If Redis is unavailable, the revocation check is skipped with a warning log. This ensures token verification continues to work (fail-open for availability). The trade-off is that a revoked token may be accepted during a Redis outage, but tokens are already short-lived (60 minutes).

### Redis Key Pattern

```
revoked:{jti}  →  TTL = token.exp - now
```

### Revocation Flow

```
App                    Passport API              Redis
 │                         │                       │
 │── POST /tokens/revoke ─▶│                       │
 │   { token: "eyJ..." }  │                       │
 │                         │── Decode JWT ──▶      │
 │                         │   Extract jti, exp    │
 │                         │                       │
 │                         │── SET revoked:{jti} ─▶│
 │                         │   TTL = exp - now     │
 │                         │                       │
 │◀── { revoked: true } ──│                       │
 │                         │                       │
 │                         │   (Later, on verify)  │
 │                         │── EXISTS revoked:{jti}▶│
 │                         │◀── 1 (revoked) ───────│
 │                         │                       │
 │◀── { valid: false,     │                       │
 │      reason: "token_   │                       │
 │      revoked" }         │                       │
```

## Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Token Lifecycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Agent                 Passport               App           │
│    │                      │                    │            │
│    │─── Request Challenge ──▶                  │            │
│    │                      │                    │            │
│    │◀── Nonce (5min TTL) ──│                   │            │
│    │                      │                    │            │
│    │─── Signed Nonce ────▶│                    │            │
│    │                      │ Verify signature   │            │
│    │                      │ Delete nonce       │            │
│    │◀── JWT (15min TTL) ──│                    │            │
│    │                      │                    │            │
│    │─────── Present JWT ──────────────────────▶│            │
│    │                      │                    │            │
│    │                      │◀── Verify JWT ─────│            │
│    │                      │                    │            │
│    │                      │─── Claims + Risk ─▶│            │
│    │                      │                    │            │
│    │                      │                    │ Accept/    │
│    │                      │                    │ Reject     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Rotation

### JWT Signing Key Rotation

1. Generate new JWK:
   ```bash
   node apps/passport-api/scripts/gen-jwk.ts
   ```

2. Update environment variable:
   ```
   JWT_SIGNING_JWK_JSON='{"kty":"OKP","crv":"Ed25519",...}'
   ```

3. Old tokens remain valid until expiration (60 min max)

4. JWKS endpoint automatically serves new key

### Agent Key Rotation

Agents can register a new public key:
1. Generate new Ed25519 keypair
2. Register with POST /agents/register
3. Receive new agent ID
4. Update configurations to use new ID

### App Key Rotation

1. Generate new key in Portal
2. Update app configuration with new key
3. Revoke old key in Portal

## Audit Logging

All security-relevant events are logged:

```typescript
// Example audit log entry
{
  "action": "IDENTITY_TOKEN_ISSUED",
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "agent-sdk/1.0"
  }
}
```

**Logged Events:**
- Agent registration
- Challenge requests
- Token issuance (success/failure)
- Token verification (success/failure)
- Token revocation
- Key generation
- Agent suspension

## Security Headers

The API includes security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'none'
```

## Secure Deployment Checklist

- [ ] HTTPS enabled (Render provides this)
- [ ] Environment variables for all secrets
- [ ] Database connection uses SSL
- [ ] Redis connection uses TLS (Upstash)
- [ ] CORS configured for allowed origins
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Error messages don't leak internal details
- [ ] Dependencies audited for vulnerabilities

## Incident Response

### Token Compromise

1. Identify affected agents/apps
2. Suspend compromised agents if needed
3. Rotate JWT signing key (invalidates all tokens)
4. Review audit logs for unauthorized access

### Database Breach

1. Rotate JWT signing key immediately
2. Force password reset for portal admins
3. Rotate all app keys
4. Review and restore from backup if needed

### Key Rotation Emergency

```bash
# Generate new JWT signing key
node apps/passport-api/scripts/gen-jwk.ts

# Update on Render
render env set JWT_SIGNING_JWK_JSON='...'

# Redeploy
render deploy
```

## Compliance Considerations

- **GDPR:** Agent metadata may contain PII; provide deletion mechanism
- **SOC 2:** Audit logging supports compliance requirements
- **OWASP:** Follows ASVS guidelines for authentication

## Reporting Security Issues

Please report security vulnerabilities responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: security@agent-passport.dev (or use GitHub Security Advisories)
3. Include: Description, reproduction steps, impact assessment
4. We aim to respond within 48 hours
5. We'll coordinate disclosure timeline with you

## References

- [Ed25519 Paper](https://ed25519.cr.yp.to/ed25519-20110926.pdf)
- [JWT Best Practices (RFC 8725)](https://www.rfc-editor.org/rfc/rfc8725)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf)
- [OAuth 2.0 Token Introspection (RFC 7662)](https://www.rfc-editor.org/rfc/rfc7662)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
