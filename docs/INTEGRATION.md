# Agent Passport Integration Guide

> Verify AI agent identities in your application with a simple API call.

## Overview

Agent Passport allows app builders to verify that an AI agent is who they claim to be. This prevents impersonation and spam while enabling seamless agent-to-app interactions.

```
┌─────────┐     ┌───────────────────┐     ┌─────────┐
│  Agent  │────▶│  Agent Passport   │◀────│  App    │
│         │     │  (Identity Layer) │     │         │
└─────────┘     └───────────────────┘     └─────────┘
    │                    │                     │
    │ 1. Register       │                     │
    │ 2. Get challenge  │                     │
    │ 3. Sign & exchange│                     │
    │ 4. Receive token  │                     │
    │                   │                     │
    └──────── 5. Present token ──────────────▶│
                        │                     │
                        │◀── 6. Verify token ─┘
                        │
                        │─── 7. Return claims ─▶
```

## Quick Start

### 1. Create an App (Portal)

1. Visit [Agent Passport Portal](https://agent-passport.vercel.app)
2. Sign in with your admin account
3. Create a new app
4. Generate an API key (copy it — it's shown only once!)

### 2. Verify Agent Tokens

When an agent presents an identity token to your app, verify it:

```typescript
// TypeScript/Node.js
const response = await fetch('https://agent-passport.onrender.com/tokens/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-App-Id': 'your-app-id',
    'X-App-Key': 'your-secret-key',
  },
  body: JSON.stringify({
    token: agentProvidedToken
  })
});

const result = await response.json();

if (result.valid) {
  console.log('Agent verified:', result.agentId);
  console.log('Agent name:', result.name);
  console.log('Risk score:', result.risk.score);
  console.log('Recommended action:', result.risk.recommendedAction);
} else {
  console.log('Token invalid:', result.reason);
}
```

### 3. Handle Risk Assessment

Every verification includes a risk assessment:

```typescript
interface RiskAssessment {
  score: number;           // 0-100 (lower is better)
  recommendedAction: 'allow' | 'throttle' | 'block';
  reasons: string[];       // Human-readable risk factors
}
```

**Example responses:**

```json
// Low risk - allow
{
  "valid": true,
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Helpful Assistant",
  "risk": {
    "score": 10,
    "recommendedAction": "allow",
    "reasons": []
  }
}

// Medium risk - throttle
{
  "valid": true,
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "name": "New Agent",
  "risk": {
    "score": 45,
    "recommendedAction": "throttle",
    "reasons": ["new_agent"]
  }
}
```

## Complete Flow

### For Agents

Agents authenticate using Ed25519 key pairs:

```typescript
import { ed25519 } from '@noble/ed25519';

// 1. Generate keypair (once, store securely)
const privateKey = ed25519.utils.randomPrivateKey();
const publicKey = await ed25519.getPublicKey(privateKey);
const publicKeyB64 = Buffer.from(publicKey).toString('base64');

// 2. Register with Agent Passport
const registerResponse = await fetch('https://agent-passport.onrender.com/agents/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: publicKeyB64,
    name: 'My AI Assistant',
    metadata: { model: 'gpt-4' }
  })
});
const { agentId } = await registerResponse.json();

// 3. Request challenge
const challengeResponse = await fetch(
  `https://agent-passport.onrender.com/agents/${agentId}/challenge`,
  { method: 'POST' }
);
const { nonce } = await challengeResponse.json();

// 4. Sign challenge
const nonceBytes = Buffer.from(nonce, 'hex');
const signature = await ed25519.sign(nonceBytes, privateKey);
const signatureB64 = Buffer.from(signature).toString('base64');

// 5. Exchange for token
const tokenResponse = await fetch(
  `https://agent-passport.onrender.com/agents/${agentId}/identity-token`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonce, signature: signatureB64 })
  }
);
const { token, expiresAt } = await tokenResponse.json();

// 6. Present token to apps
// Include in Authorization header or request body
```

### For Apps

```typescript
// Verify tokens on every agent request
async function verifyAgentToken(token: string) {
  const response = await fetch('https://agent-passport.onrender.com/tokens/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': process.env.PASSPORT_APP_ID!,
      'X-App-Key': process.env.PASSPORT_APP_KEY!,
    },
    body: JSON.stringify({ token })
  });
  
  return response.json();
}

// In your API handler
app.post('/api/agent-action', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No agent token provided' });
  }
  
  const verification = await verifyAgentToken(token);
  
  if (!verification.valid) {
    return res.status(401).json({ error: verification.reason });
  }
  
  // Handle based on risk assessment
  if (verification.risk.recommendedAction === 'block') {
    return res.status(403).json({ error: 'Agent blocked due to risk assessment' });
  }
  
  if (verification.risk.recommendedAction === 'throttle') {
    // Apply stricter rate limits for this agent
  }
  
  // Process the agent's request
  // verification.agentId is the verified agent identity
});
```

## Token Revocation

If a token is compromised or an agent session should be terminated early, revoke it:

```typescript
async function revokeAgentToken(token: string) {
  const response = await fetch('https://agent-passport.onrender.com/tokens/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': process.env.PASSPORT_APP_ID!,
      'X-App-Key': process.env.PASSPORT_APP_KEY!,
    },
    body: JSON.stringify({ token })
  });

  const result = await response.json();

  if (result.revoked) {
    console.log('Token revoked:', result.jti);
    console.log('Blocklist expires:', result.expiresAt);
  }
}
```

**Using the SDK:**

```typescript
import { AgentPassportClient } from '@zerobase-labs/passport-sdk';

const client = new AgentPassportClient({
  baseUrl: 'https://agent-passport.onrender.com',
  appId: process.env.PASSPORT_APP_ID!,
  appKey: process.env.PASSPORT_APP_KEY!,
});

const { revoked, jti } = await client.revoke(compromisedToken);
console.log('Token revoked:', revoked, 'JTI:', jti);
```

After revocation, any subsequent `verify` call for that token returns `{ valid: false, reason: "token_revoked" }`. Blocklist entries auto-expire when the token would have expired naturally.

## Local Token Verification (JWKS)

For high-throughput scenarios, verify tokens locally using JWKS:

```typescript
import * as jose from 'jose';

// Fetch JWKS once (cache it)
const JWKS = jose.createRemoteJWKSet(
  new URL('https://agent-passport.onrender.com/.well-known/jwks.json')
);

async function verifyTokenLocally(token: string) {
  try {
    const { payload } = await jose.jwtVerify(token, JWKS, {
      issuer: 'agent-passport',
      algorithms: ['EdDSA'],
    });
    
    return {
      valid: true,
      agentId: payload.sub,
      name: payload.agent_name,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof jose.errors.JWTExpired ? 'expired' : 'invalid_signature',
    };
  }
}
```

**Note:** Local verification doesn't include risk assessment. Use the `/tokens/verify` endpoint when you need risk scoring.

## Error Handling

### Verification Errors

| Reason | Description | Action |
|--------|-------------|--------|
| `invalid_signature` | Token signature doesn't match | Reject request |
| `expired` | Token has expired | Ask agent to re-authenticate |
| `token_revoked` | Token has been revoked | Reject request; agent must re-authenticate |
| `agent_suspended` | Agent has been suspended | Reject request |
| `agent_not_found` | Agent doesn't exist | Reject request |
| `invalid_token` | Malformed token | Reject request |
| `internal_error` | Server error | Retry with backoff |

### Rate Limits

The API uses rate limiting to prevent abuse:

| Endpoint | Agent Limit | IP Limit |
|----------|-------------|----------|
| `/agents/{id}/challenge` | 60/min | 120/min |
| `/agents/{id}/identity-token` | 30/min | 60/min |
| `/tokens/verify` | 600/min per app | 120/min |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Max requests in window
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait (on 429)

## Best Practices

1. **Cache your App credentials** in environment variables, never commit them
2. **Verify on every request** — tokens are short-lived (60 min)
3. **Respect risk recommendations** — they help prevent abuse
4. **Use JWKS for high throughput** — reduces API calls
5. **Handle rate limits gracefully** — implement exponential backoff
6. **Log agent interactions** — for debugging and auditing

## Security Considerations

- App keys are hashed with Argon2id — we never store them in plaintext
- Agent private keys never leave the agent — only signatures are transmitted
- Tokens are signed with Ed25519 (EdDSA) — fast and secure
- Challenges expire in 5 minutes — prevents replay attacks
- Tokens expire in 60 minutes — limits exposure window

## Human Verification

Agent Passport supports linking verified human identities to agents, creating a full accountability chain:

```
Human (verified) → Agent Passport → Agent = full accountability
```

### Supported Providers

| Provider | Description |
|----------|------------|
| `github` | GitHub OAuth identity |
| `mercle` | Mercle decentralized identity |
| `google` | Google OAuth identity |
| `email` | Email verification |
| `phone` | Phone number verification |
| `worldcoin` | Worldcoin proof-of-personhood |
| `civic` | Civic identity verification |

### Link a Human Verification

Agents can link their verified human identity (requires agent identity token):

```bash
curl -X POST https://agent-passport.onrender.com/v1/agents/{agentId}/human-verification \
  -H "Authorization: Bearer {agent-identity-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "github",
    "providerId": "12345",
    "displayName": "Jane Developer"
  }'
```

### Check Human Verification Status

Anyone can check if an agent has a verified human behind it (public endpoint):

```bash
curl https://agent-passport.onrender.com/v1/agents/{agentId}/human-verification
```

Response:
```json
{
  "verified": true,
  "verifications": [
    {
      "id": "...",
      "provider": "github",
      "providerId": "12345",
      "displayName": "Jane Developer",
      "verifiedAt": "2025-02-21T...",
      "expiresAt": null,
      "status": "active"
    }
  ]
}
```

### Human Verification in Token Verification

When apps verify an agent's token, the response now includes human verification info:

```json
{
  "valid": true,
  "agent": { "id": "...", "handle": "my-agent" },
  "scopes": [],
  "risk": { "score": 0, "recommendedAction": "allow", "reasons": [] },
  "humanVerification": {
    "verified": true,
    "verifications": [
      {
        "provider": "github",
        "displayName": "Jane Developer",
        "verifiedAt": "2025-02-21T..."
      }
    ]
  }
}
```

Apps can use this to make trust decisions:

```typescript
const result = await passport.verify(token);
if (result.valid && result.humanVerification?.verified) {
  // Agent has a verified human ✓ — full accountability chain intact
  console.log(`Verified by: ${result.humanVerification.verifications[0].displayName}`);
}
```

### Revoke a Human Verification

```bash
curl -X DELETE https://agent-passport.onrender.com/v1/agents/{agentId}/human-verification/github \
  -H "Authorization: Bearer {agent-identity-token}"
```

## Support

- [OpenAPI Specification](./openapi.yaml)
- [Smoke Test Guide](./SMOKE_TEST.md)
- [Security Documentation](./SECURITY.md)
- [GitHub Issues](https://github.com/zerobase-labs/agent-passport/issues)
