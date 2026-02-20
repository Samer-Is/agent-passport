# Securing AI Agents with Agent Passport — OpenClaw Integration Example

> How to add identity verification to any AI agent ecosystem (OpenClaw, custom platforms, skill marketplaces)

## The Problem

AI agent ecosystems like OpenClaw (180K+ GitHub stars) have a critical security gap: **there's no way to verify who an agent actually is**. This means:

- **Malicious agents can impersonate others** — a bad actor can claim to be "TrustedAssistant" and no one can verify it
- **Skill marketplaces have no auth layer** — any agent can call any skill, with no accountability
- **Data exfiltration is easy** — Cisco's security team found third-party agent skills stealing data from host applications

Agent Passport fixes this with cryptographic identity verification.

## How It Works

```
┌────────────────────────────────────────────────────────────────┐
│                    Agent Passport Flow                          │
│                                                                 │
│  ┌──────────┐         ┌─────────────────┐       ┌──────────┐  │
│  │  Agent    │         │  Agent Passport │       │  Skill   │  │
│  │ (OpenClaw)│         │    (Identity)   │       │ Gateway  │  │
│  └────┬─────┘         └───────┬─────────┘       └────┬─────┘  │
│       │                       │                       │        │
│       │ 1. Register (pubkey) ▶│                       │        │
│       │◀ Agent ID ────────────│                       │        │
│       │                       │                       │        │
│       │ 2. Challenge ────────▶│                       │        │
│       │◀ Nonce ───────────────│                       │        │
│       │                       │                       │        │
│       │ 3. Sign + Exchange ──▶│                       │        │
│       │◀ JWT Token ───────────│                       │        │
│       │                       │                       │        │
│       │ 4. Execute skill ─────┼───────────────────────▶        │
│       │   (with JWT token)    │                       │        │
│       │                       │◀── 5. Verify token ───│        │
│       │                       │─── Claims + risk ────▶│        │
│       │                       │                       │        │
│       │◀── 6. Skill result ───┼───────────────────────│        │
│       │                       │                       │        │
│  ┌────┴─────┐         ┌───────┴─────────┐       ┌────┴─────┐  │
│  │ Private  │         │  Ed25519 + JWT  │       │ Verified │  │
│  │ key NEVER│         │  Risk Engine    │       │ Identity │  │
│  │ leaves   │         │  Audit Logging  │       │ + Risk   │  │
│  └──────────┘         └─────────────────┘       └──────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- An Agent Passport API instance (deployed or local)
- App credentials from the Agent Passport Portal

### 1. Agent Side — Register

```bash
cd agent-side
npm install
npx tsx register-agent.ts
```

This generates an Ed25519 keypair and registers the agent. Credentials are saved to `.agent-credentials.json`.

### 2. Agent Side — Authenticate

```bash
npx tsx authenticate-agent.ts
```

This runs the full challenge-response flow:
1. Requests a challenge nonce from Agent Passport
2. Signs the nonce with the agent's private key (key never leaves the process)
3. Exchanges the signature for a JWT identity token (60 min TTL)

### 3. App Side — Start Skill Gateway

```bash
cd ../app-side
npm install
PASSPORT_APP_ID=your-id PASSPORT_APP_KEY=your-key npx tsx skill-gateway.ts
```

The skill gateway requires a valid agent identity token on every request to protected endpoints.

### 4. End-to-End Demo

Run everything in one script:

```bash
cd ../e2e-demo
npm install
PASSPORT_URL=https://passport-api.onrender.com \
PASSPORT_APP_ID=your-id \
PASSPORT_APP_KEY=your-key \
npx tsx demo.ts
```

## Project Structure

```
openclaw-integration/
├── README.md                  ← You are here
├── agent-side/
│   ├── register-agent.ts      # Step 1: Register agent identity
│   ├── authenticate-agent.ts  # Step 2: Challenge-response auth
│   └── package.json
├── app-side/
│   ├── verify-middleware.ts    # Drop-in Express middleware
│   ├── skill-gateway.ts       # Example skill marketplace
│   └── package.json
└── e2e-demo/
    ├── demo.ts                # Full end-to-end demo
    └── package.json
```

## Key Security Properties

| Property | How It Works |
|----------|-------------|
| **No impersonation** | Ed25519 signatures are unforgeable without the private key |
| **Private key safety** | Sign callback pattern — private keys never leave the agent process |
| **Short-lived tokens** | JWT tokens expire in 60 minutes; revocable via Redis blocklist |
| **Risk scoring** | Every verification includes a 0-100 risk score with allow/throttle/block |
| **Replay protection** | Challenge nonces are single-use and expire in 5 minutes |
| **Audit trail** | Every registration, authentication, and verification is logged |

## How to Integrate with Your Platform

This example uses OpenClaw as the framing, but the pattern works for **any agent platform**:

1. **Agent framework** (LangChain, CrewAI, AutoGPT) → Use `AgentClient` to register and authenticate
2. **Skill/plugin marketplace** → Use `AgentPassportClient` to verify agent tokens before granting access
3. **Multi-agent system** → Each agent gets its own identity; orchestrators verify agent identities before delegation

The SDK handles all the cryptographic plumbing. Your integration is just:

```typescript
// Agent side (3 lines)
const agent = new AgentClient({ baseUrl: 'https://passport-api.onrender.com' });
const reg = await agent.register({ handle: 'my-agent', publicKeyB64 });
const { token } = await agent.authenticate({ agentId: reg.agentId, sign: mySignFn });

// App side (3 lines)
const passport = new AgentPassportClient({ baseUrl, appId, appKey });
const result = await passport.verify(token);
if (result.valid && result.risk.action === 'allow') { /* proceed */ }
```

## Further Reading

- [Integration Guide](../../docs/INTEGRATION.md) — Detailed integration walkthrough
- [Security Documentation](../../docs/SECURITY.md) — Threat model and cryptographic details
- [OpenAPI Specification](../../docs/openapi.yaml) — Full API reference
- [SDK Documentation](../../packages/sdk/README.md) — `@zerobase-labs/passport-sdk` API reference
- [Smoke Test](../../docs/SMOKE_TEST.md) — Validate your deployment with curl
