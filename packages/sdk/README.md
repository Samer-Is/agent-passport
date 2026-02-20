# @zerobase-labs/passport-sdk

> SDK for **Agent Passport** — OAuth-like identity verification for AI agents.

Verify agent identities in 3 lines. Authenticate agents in 5.

## Installation

```bash
npm install @zerobase-labs/passport-sdk
```

```bash
pnpm add @zerobase-labs/passport-sdk
```

```bash
yarn add @zerobase-labs/passport-sdk
```

## Quick Start — For Apps (Verify Agents)

```typescript
import { AgentPassportClient } from '@zerobase-labs/passport-sdk';

const passport = new AgentPassportClient({
  baseUrl: 'https://passport-api.onrender.com',
  appId: 'your-app-id',
  appKey: 'ap_live_...',
});

const result = await passport.verify(agentToken);
if (result.valid && result.risk?.recommendedAction === 'allow') {
  console.log(`Verified agent: ${result.handle}`);
}
```

## Quick Start — For Agents (Authenticate)

```typescript
import { AgentClient } from '@zerobase-labs/passport-sdk';

const agent = new AgentClient({
  baseUrl: 'https://passport-api.onrender.com',
});

// Register once
const { agentId } = await agent.register({
  handle: 'my-agent',
  publicKeyB64: '<your-ed25519-public-key-base64>',
});

// Authenticate (challenge → sign → token)
const { token, expiresAt } = await agent.authenticate({
  agentId,
  sign: async (nonce) => {
    // Sign with YOUR private key — it never enters the SDK
    return signWithEd25519(nonce, privateKey);
  },
});
```

**Security**: Private keys never enter this SDK. The `sign` callback keeps signing in your code.

## API Reference

### `AgentPassportClient` (for apps)

```typescript
new AgentPassportClient({
  baseUrl: string;    // Agent Passport API URL
  appId: string;      // Your App ID (from portal)
  appKey: string;     // Your API key (ap_live_...)
  timeoutMs?: number; // Request timeout (default: 10000)
  maxRetries?: number; // Max retries on 429 (default: 3)
})
```

| Method | Description |
|--------|-------------|
| `verify(token)` | Verify an agent's identity token |
| `introspect(token)` | Introspect a token (RFC 7662) |
| `revoke(token)` | Revoke a token before expiry |

### `AgentClient` (for agents)

```typescript
new AgentClient({
  baseUrl: string;    // Agent Passport API URL
  timeoutMs?: number; // Request timeout (default: 10000)
  maxRetries?: number; // Max retries on 429 (default: 3)
})
```

| Method | Description |
|--------|-------------|
| `register({ handle, publicKeyB64 })` | Register a new agent |
| `authenticate({ agentId, sign })` | Full auth flow (challenge → sign → token) |
| `getChallenge(agentId)` | Request a challenge nonce |
| `exchangeToken({ agentId, challengeId, signatureB64 })` | Exchange signature for JWT |

## Error Handling

```typescript
import {
  PassportError,
  PassportAuthError,
  PassportRateLimitError,
  PassportNetworkError,
  PassportValidationError,
} from '@zerobase-labs/passport-sdk';

try {
  const result = await passport.verify(token);
} catch (err) {
  if (err instanceof PassportRateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`);
  } else if (err instanceof PassportAuthError) {
    console.log('Invalid credentials:', err.message);
  } else if (err instanceof PassportNetworkError) {
    console.log('Cannot reach API:', err.message);
  } else if (err instanceof PassportValidationError) {
    console.log('Bad request:', err.message);
  }
}
```

The SDK automatically retries 429 responses with exponential backoff (configurable via `maxRetries`).

## Compatibility

- Node.js 18+
- Bun
- Deno
- Any runtime with `globalThis.fetch`

Zero runtime dependencies other than `zod`.

## Links

- [Main Repository](https://github.com/zerobase-labs/agent-passport)
- [API Documentation](https://github.com/zerobase-labs/agent-passport/blob/main/docs/openapi.yaml)
- [Integration Guide](https://github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md)

## License

MIT
