# @agent-passport/openclaw-plugin

> Drop-in identity verification for OpenClaw-style AI agent ecosystems.

Add cryptographic agent identity verification to your skill marketplace in **3 lines of code**. Works with Express, Fastify, or any framework.

## Install

```bash
npm install @agent-passport/openclaw-plugin
```

## Quick Start (Express)

```typescript
import express from 'express';
import { agentPassport } from '@agent-passport/openclaw-plugin/express';

const app = express();
const passport = agentPassport({
  baseUrl: 'https://agent-passport.onrender.com',
  appId: process.env.PASSPORT_APP_ID!,
  appKey: process.env.PASSPORT_APP_KEY!,
});

// Public — anyone can browse skills
app.get('/skills', (req, res) => {
  res.json({ skills: ['web-search', 'calendar', 'email-send'] });
});

// Protected — only verified agents can execute skills
app.post('/skills/:id/execute', passport.requireAgent(), (req, res) => {
  const { agentId, handle, risk } = req.verifiedAgent!;
  
  // Block high-risk agents from sensitive skills
  if (risk.score > 30 && req.params.id === 'email-send') {
    return res.status(403).json({ error: 'Risk too high' });
  }
  
  res.json({ executed: true, by: handle, riskScore: risk.score });
});
```

## Quick Start (Fastify)

```typescript
import Fastify from 'fastify';
import { agentPassportPlugin } from '@agent-passport/openclaw-plugin/fastify';

const app = Fastify();

await app.register(agentPassportPlugin, {
  baseUrl: 'https://agent-passport.onrender.com',
  appId: process.env.PASSPORT_APP_ID!,
  appKey: process.env.PASSPORT_APP_KEY!,
});

app.post('/skills/:id/execute', {
  preHandler: app.requireAgent,
}, async (request) => {
  const { agentId, handle, risk } = request.verifiedAgent!;
  return { executed: true, by: handle, riskScore: risk.score };
});
```

## Framework-Agnostic (Custom)

Use `createVerifier()` for any framework or runtime:

```typescript
import { createVerifier } from '@agent-passport/openclaw-plugin';

const verify = createVerifier({
  baseUrl: 'https://agent-passport.onrender.com',
  appId: 'your-app-id',
  appKey: 'your-app-key',
});

// In your handler:
const result = await verify(tokenFromRequest);

if (result.verified) {
  console.log(result.agent.handle);    // "research-bot"
  console.log(result.agent.risk.score); // 12
  console.log(result.agent.risk.action); // "allow"
} else {
  console.log(result.error);  // "Invalid agent identity"
  console.log(result.status); // 401 or 403
}
```

## API

### `agentPassport(options)` (Express)

Returns an object with:
- **`requireAgent()`** — Middleware that blocks unauthenticated/blocked agents. Sets `req.verifiedAgent`.
- **`optionalAgent()`** — Middleware that verifies if a token is present but doesn't block anonymous requests.

### `agentPassportPlugin` (Fastify)

Registers with `app.register()`. Adds:
- **`app.requireAgent`** — preHandler hook
- **`app.optionalAgent`** — preHandler hook
- **`request.verifiedAgent`** — available on verified requests

### `createVerifier(options)` (Framework-agnostic)

Returns `async (token: string | undefined) => VerificationResult`.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | required | Agent Passport API URL |
| `appId` | `string` | required | Your app ID |
| `appKey` | `string` | required | Your app API key |
| `tokenHeader` | `string` | `'x-agent-token'` | Header to read the JWT from |
| `blockActions` | `RiskAction[]` | `['block']` | Risk actions that trigger 403 |
| `onVerified` | `(agent) => void` | — | Callback on successful verification |
| `onRejected` | `(reason, token?) => void` | — | Callback on failed verification |

### `VerifiedAgent`

```typescript
interface VerifiedAgent {
  agentId: string;
  handle: string | null;
  risk: {
    score: number;     // 0-100
    action: string;    // "allow" | "throttle" | "block"
    reasons: string[];
  };
}
```

## How It Works

1. Agent sends a JWT identity token in the `X-Agent-Token` header
2. The plugin calls the Agent Passport API to verify the token
3. Agent Passport returns the agent's identity and risk score
4. The plugin either allows the request (attaching `verifiedAgent`) or blocks it

```
Agent → [X-Agent-Token: eyJ...] → Your App → Agent Passport API
                                              ↓
                                     { valid: true,
                                       agentId: "ag_abc",
                                       risk: { score: 12, action: "allow" } }
```

## Related

- [Agent Passport](https://github.com/zerobase-labs/agent-passport) — The identity verification system
- [SDK](https://www.npmjs.com/package/@zerobase-labs/passport-sdk) — Full client SDK for agents and apps
- [Integration Guide](https://github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md)
- [OpenClaw Integration Example](https://github.com/zerobase-labs/agent-passport/tree/main/examples/openclaw-integration) — Full E2E demo

## License

MIT
