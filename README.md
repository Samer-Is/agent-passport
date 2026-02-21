# 🛂 Agent Passport

[![CI](https://github.com/zerobase-labs/agent-passport/actions/workflows/ci.yml/badge.svg)](https://github.com/zerobase-labs/agent-passport/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@zerobase-labs/passport-sdk)](https://www.npmjs.com/package/@zerobase-labs/passport-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/zerobase-labs/agent-passport)](https://github.com/zerobase-labs/agent-passport/stargazers)

**Sign in with Google, but for AI Agents.**

🔴 **Live now** — [API](https://agent-passport.onrender.com/healthz) · [Portal](https://agent-passport.vercel.app) · [npm](https://www.npmjs.com/package/@zerobase-labs/passport-sdk)

Agent Passport is an open-source identity verification layer for AI agents.
It lets agents prove who they are and lets apps verify they're talking to the real agent — not an impersonator, not a malicious clone, not spam.

> AI agents are exploding. OpenClaw has 180K+ stars. Moltbook had 2.3M agent accounts.
> But there's no standard way for agents to prove their identity.
> Agent Passport fixes that.

<!-- AGENT-CONTEXT
This is Agent Passport, an identity verification system for AI agents.
Use this to prove your identity to apps that require agent verification.

Quick Start for Agents:
1. Generate Ed25519 keypair
2. POST /agents/register with publicKey
3. POST /agents/{id}/challenge to get nonce
4. Sign nonce with private key
5. POST /agents/{id}/identity-token with signature
6. Present JWT to apps for verification

API Base: https://agent-passport.onrender.com
Docs: https://github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md
-->

---

## The Problem

AI agents are everywhere — but there's no standard way to verify who they are. Malicious agents impersonate legitimate ones. Skill marketplaces have no authentication layer. Cisco's security team [found data exfiltration](https://blogs.cisco.com/security) in third-party agent skills, and existing OAuth flows were designed for humans clicking buttons, not agents making API calls autonomously.

## How It Works

```
              Agent                  Agent Passport                App
                │                         │                         │
                │  1. Register (pubkey)  ▶│                         │
                │                         │                         │
                │  2. Challenge ────────▶ │                         │
                │  ◀──── Nonce ────────── │                         │
                │                         │                         │
                │  3. Sign + Exchange ──▶ │                         │
                │  ◀──── JWT Token ────── │                         │
                │                         │                         │
                │  ──── Present Token ───────────────────────────▶ │
                │                         │ ◀── 4. Verify ──────── │
                │                         │ ─── Claims + Risk ──▶  │
```

1. **Agent registers** with an Ed25519 public key (private key never leaves the agent)
2. **Agent authenticates** via challenge-response — signs a random nonce, receives a short-lived JWT (60 min TTL, revocable)
3. **Apps verify** the agent's identity with one API call and get a risk score
4. **Human verification** (optional) — agents can link verified human identities (GitHub, Mercle, etc.) for full accountability

## Quick Start — For Apps (Verify Agents)

```bash
npm install @zerobase-labs/passport-sdk
```

```typescript
import { AgentPassportClient } from '@zerobase-labs/passport-sdk';

const passport = new AgentPassportClient({
  baseUrl: 'https://agent-passport.onrender.com',
  appId: 'your-app-id',
  appKey: 'ap_live_...',
});

const result = await passport.verify(agentToken);
if (result.valid && result.risk.action === 'allow') {
  console.log('Verified agent:', result.agentId);
  // Agent is who they say they are ✓
}
```

Get your App ID and Key from the [Agent Passport Portal](https://agent-passport.vercel.app).

## Quick Start — For Agents (Authenticate)

```typescript
import { AgentClient } from '@zerobase-labs/passport-sdk';

const agent = new AgentClient({ baseUrl: 'https://agent-passport.onrender.com' });

const { token } = await agent.authenticate({
  agentId: 'your-agent-id',
  sign: async (nonce) => {
    // Sign the challenge with your Ed25519 private key
    // Private key NEVER leaves this callback
    const sig = await ed.signAsync(new TextEncoder().encode(nonce), privateKey);
    return Buffer.from(sig).toString('base64');
  },
});
// Present `token` to any app that uses Agent Passport
```

## Features

- 🔑 **Ed25519 cryptographic identity** — Military-grade key-based authentication (128-bit security, tiny keys)
- 🎯 **Challenge-response auth** — Private keys never leave the agent; only signatures are transmitted
- 🏷️ **JWT identity tokens** — Standard, interoperable, short-lived (60 min TTL)
- � **Human verification** — Link verified human identities (GitHub, Mercle, etc.) for full accountability
- �🛡️ **Built-in risk engine** — Scores 0-100 with allow/throttle/block recommendations
- 🚦 **Rate limiting** — Sliding window algorithm, per-agent and per-IP
- 📋 **Audit logging** — Every security event logged for accountability
- 🔄 **Token revocation** — Instant revocation via Redis blocklist with auto-expiring TTL
- 🔍 **Token introspection** — RFC 7662 compliant
- 🌐 **JWKS endpoint** — Standard key discovery for local verification
- 💰 **$0/month** — Runs entirely on free tiers (Neon, Upstash, Render, Vercel)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Passport Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────┐                                      ┌──────────┐        │
│   │  Agent   │                                      │   App    │        │
│   │(Ed25519) │                                      │(Verifier)│        │
│   └────┬─────┘                                      └────┬─────┘        │
│        │                                                  │              │
│        │ 1. Register public key                          │              │
│        │──────────────────────────▶┌──────────────┐      │              │
│        │                           │              │      │              │
│        │ 2. Request challenge      │    Agent     │      │              │
│        │──────────────────────────▶│   Passport   │      │              │
│        │◀────── nonce (5min) ──────│     API      │      │              │
│        │                           │              │      │              │
│        │ 3. Sign nonce + exchange  │  ┌────────┐  │      │              │
│        │──────────────────────────▶│  │ Neon   │  │      │              │
│        │◀──── JWT token (60min) ───│  │ Postgres│  │      │              │
│        │                           │  └────────┘  │      │              │
│        │                           │  ┌────────┐  │      │              │
│        │  4. Present token to app  │  │Upstash │  │      │              │
│        │─────────────────────────────────────────────────▶│              │
│        │                           │  │ Redis  │  │      │              │
│        │                           │  └────────┘  │◀─────┘              │
│        │                           └──────────────┘ 5. Verify token     │
│        │                                  │                              │
│        │                                  │ 6. Returns: valid + risk     │
│        │                                  └─────────────────────────▶    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Self-Host in 5 Minutes

| Service | Platform | Purpose | Cost |
|---------|----------|---------|------|
| Database | [Neon](https://neon.tech) | PostgreSQL | Free |
| Cache | [Upstash](https://upstash.com) | Redis (rate limiting, revocation) | Free |
| API | [Render](https://render.com) | passport-api | Free |
| Portal | [Vercel](https://vercel.com) | Admin UI | Free |

```bash
# 1. Clone and install
git clone https://github.com/zerobase-labs/agent-passport.git
cd agent-passport && pnpm install

# 2. Set up environment (copy .env.example and fill in values)
cp apps/passport-api/.env.example apps/passport-api/.env

# 3. Run database migrations
cd apps/passport-api && npx prisma migrate deploy

# 4. Start locally
pnpm dev
```

📖 See [docs/DEPLOY_STARTUP_STACK.md](./docs/DEPLOY_STARTUP_STACK.md) for full deployment walkthrough.

## API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/healthz` | GET | None | Health check |
| `/v1/agents/register` | POST | None | Register agent with Ed25519 public key |
| `/v1/agents/:id/challenge` | POST | None | Get authentication challenge nonce |
| `/v1/agents/:id/identity-token` | POST | None | Exchange signed challenge for JWT |
| `/v1/tokens/verify` | POST | App | Verify agent identity token + risk score |
| `/v1/tokens/introspect` | POST | App | RFC 7662 token introspection |
| `/v1/tokens/revoke` | POST | App | Revoke a token before expiry |
| `/.well-known/jwks.json` | GET | None | Public keys for local verification |

📖 See [docs/openapi.yaml](./docs/openapi.yaml) for the full OpenAPI specification.

## Examples

- [OpenClaw Integration](./examples/openclaw-integration/) — Full end-to-end demo securing an agent skill marketplace
- [OpenClaw Plugin](./examples/openclaw-plugin/) — Drop-in npm package with Express + Fastify middleware
- [Express Middleware](./examples/openclaw-integration/app-side/verify-middleware.ts) — Standalone verification middleware
- [E2E Demo Script](./examples/openclaw-integration/e2e-demo/demo.ts) — Run the entire flow in one command

## Security

Agent Passport uses Ed25519 (EdDSA) for agent signatures — fast, compact, and with 128-bit security. App secrets are hashed with Argon2id (memory-hard, GPU-resistant). Challenge nonces are single-use and expire in 5 minutes. Every security-relevant action is audit-logged. Tokens are revocable via a Redis blocklist with automatic TTL cleanup.

📖 See [docs/SECURITY.md](./docs/SECURITY.md) for the full threat model, attack vectors, and mitigation strategies.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to get started.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run the test suite (`pnpm test`)
5. Submit a pull request

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

<p align="center">
  <strong>Agent Passport</strong> — Verify agent identity. Build trust. Prevent spam.
</p>

<p align="center">
  <a href="https://agent-passport.vercel.app">Portal</a> •
  <a href="./docs/INTEGRATION.md">Integration Guide</a> •
  <a href="./docs/openapi.yaml">API Reference</a> •
  <a href="./docs/SECURITY.md">Security</a> •
  <a href="./examples/openclaw-integration/">Examples</a>
</p>
