---
title: How OpenClaw Handles Agent Identity Today (It Doesn't) — And How to Fix It
published: false
description: AI agent ecosystems like OpenClaw have 180K+ GitHub stars but zero identity verification. Here's the security gap and an open-source fix.
tags: ai, security, opensource, typescript
cover_image:
---

# How OpenClaw Handles Agent Identity Today (It Doesn't)

OpenClaw is one of the most popular open-source AI agent frameworks — 180K+ GitHub stars, massive community, thriving skill marketplace.

But here's the thing: **there's no way to verify who an agent actually is**.

Any agent can call any skill. Any agent can claim to be any other agent. There's no authentication, no identity layer, no accountability.

This isn't a theoretical problem. Cisco's security research team documented cases of third-party agent skills performing **data exfiltration** from host applications. The agent ecosystem has an identity crisis.

---

## What "No Identity" Actually Means

Let's make this concrete. Here's what happens today when an agent calls a skill in OpenClaw:

```
Agent "TrustedBot" → calls email-send skill → sends email
Agent "MaliciousBot" (pretending to be "TrustedBot") → calls email-send skill → sends spam
```

The skill marketplace can't tell the difference. There's no cryptographic proof of who's calling. No audit trail. No way to revoke access to a specific agent.

Compare this to how web apps work:

| | Web Apps | AI Agents (today) |
|---|---------|-------------------|
| **Identity** | OAuth / JWT / session cookies | Nothing |
| **Verification** | "Sign in with Google" | Agent says "trust me bro" |
| **Revocation** | Token blocklists, session invalidation | N/A |
| **Risk scoring** | IP reputation, fraud detection | N/A |
| **Audit trail** | Every action linked to verified user | Agent handles are unverified strings |

Agents are where web apps were in 1995 — before cookies, before OAuth, before any identity standard existed.

---

## The Three Attack Vectors

### 1. Agent Impersonation

Without identity verification, nothing stops `EvilAgent` from claiming to be `ProductionAssistant`. If your skill marketplace gates features by agent handle (a string), that's trivially spoofable.

### 2. Skill Abuse Without Accountability

When an agent calls a sensitive skill (send email, process payment, access database), there's no verified identity attached to that call. If something goes wrong, you have no audit trail.

### 3. Data Exfiltration via Malicious Skills

Cisco found this in the wild: third-party skills that appear legitimate but siphon data back to an attacker. Without verified agent identity, you can't even implement basic trust policies like "only allow verified agents to use this skill" or "block agents with a bad track record."

---

## The Fix: Cryptographic Agent Identity

We built [Agent Passport](https://github.com/zerobase-labs/agent-passport) — an open-source identity verification layer specifically for AI agents. Think "Sign in with Google, but for Agents."

Here's the flow:

```
┌─────────────┐         ┌──────────────────┐         ┌───────────┐
│    Agent     │         │  Agent Passport  │         │   Skill   │
│  (OpenClaw)  │         │   (Identity)     │         │  Gateway  │
└──────┬──────┘         └────────┬─────────┘         └─────┬─────┘
       │                         │                         │
       │ 1. Register (pubkey)  ──▶                         │
       │◀── Agent ID ───────────│                         │
       │                         │                         │
       │ 2. Challenge ──────────▶                         │
       │◀── Nonce ──────────────│                         │
       │                         │                         │
       │ 3. Sign + Exchange ────▶                         │
       │◀── JWT Token ──────────│                         │
       │                         │                         │
       │ 4. Call skill ──────────┼─────────────────────────▶
       │    (with JWT)           │                         │
       │                         │◀── 5. Verify token ────│
       │                         │──── Identity + risk ───▶│
       │                         │                         │
       │◀── 6. Skill result ────┼─────────────────────────│
```

Key properties:

- **Ed25519 signatures** — unforgeable without the private key
- **Private key never leaves the agent** — zero-knowledge authentication
- **JWT tokens** — 60-minute TTL, instantly revocable
- **Risk scoring** — every agent gets a 0-100 score (allow / throttle / block)
- **Single-use nonces** — replay attacks are impossible
- **Human verification** — agents can link verified human identities (GitHub, Mercle, Google, Worldcoin, etc.) for full accountability

---

## Before vs. After: Code Comparison

### Before: Any Agent Can Call Any Skill

```typescript
// Current OpenClaw skill handler — no identity check
app.post('/skills/email-send/execute', (req, res) => {
  // Who is calling this? No idea. The agent says it's "TrustedBot"
  // but anyone can set that header.
  const agentName = req.headers['x-agent-name']; // unverified string
  
  sendEmail(req.body.to, req.body.subject, req.body.body);
  res.json({ sent: true });
});
```

### After: Only Verified Agents Can Call Skills

```typescript
import { requireVerifiedAgent } from './verify-middleware';

// With Agent Passport — cryptographic identity verification
app.post('/skills/email-send/execute', requireVerifiedAgent(), (req, res) => {
  // req.verifiedAgent is cryptographically proven
  const { agentId, handle, risk } = req.verifiedAgent;
  
  console.log(`Agent ${handle} (risk: ${risk.score}) sending email`);
  
  // Block high-risk agents from sensitive operations
  if (risk.score > 30) {
    return res.status(403).json({ error: 'Risk too high for email skill' });
  }
  
  sendEmail(req.body.to, req.body.subject, req.body.body);
  res.json({ sent: true, verifiedBy: agentId });
});
```

The middleware handles all the cryptographic verification. Your skill code just reads `req.verifiedAgent`.

---

## Agent-Side Integration: 6 Lines

```typescript
import { AgentClient } from '@zerobase-labs/passport-sdk';

const client = new AgentClient({
  baseUrl: 'https://agent-passport.onrender.com'
});

// Register once
const { agentId } = await client.register({
  handle: 'my-openclaw-agent',
  publicKeyB64: myPublicKey,
});

// Authenticate when you need to call skills
const { token } = await client.authenticate({
  agentId,
  sign: async (nonce) => {
    // Sign the challenge — private key NEVER leaves this process
    const sig = await ed.signAsync(new TextEncoder().encode(nonce), privateKey);
    return Buffer.from(sig).toString('base64');
  },
});

// Use the token when calling skills
fetch('https://skill-gateway.example.com/skills/web-search/execute', {
  headers: { 'X-Agent-Token': token },
  // ...
});
```

---

## App-Side Verification: 3 Lines

```typescript
import { AgentPassportClient } from '@zerobase-labs/passport-sdk';

const passport = new AgentPassportClient({
  baseUrl: 'https://agent-passport.onrender.com',
  appId: 'your-app-id',
  appKey: 'your-app-key',
});

const result = await passport.verify(token);

if (result.valid && result.risk.action === 'allow') {
  // Proceed — this agent is who they claim to be
  console.log(`Verified: ${result.agentId}, risk score: ${result.risk.score}`);
  
  // Check if a real human is behind this agent
  if (result.humanVerification?.verified) {
    console.log('Human verified via:', result.humanVerification.verifications.map(v => v.provider).join(', '));
  }
}
```

---

## What This Enables

With verified agent identity, skill marketplaces can:

| Capability | Without Identity | With Agent Passport |
|-----------|-----------------|-------------------|
| **Gate sensitive skills** | Anyone can call any skill | Only verified, low-risk agents |
| **Audit trail** | "some agent did something" | "agent `ag_abc123` (handle: `research-bot`) called `email-send` at 14:32:07" |
| **Rate limit by identity** | By IP (easily bypassed) | By cryptographically verified agent ID |
| **Trust tiers** | None | new (cautious) → established (normal) → trusted (full access) |
| **Instant revocation** | Can't target specific agents | Revoke one agent's token in milliseconds |
| **Reputation** | Hope for the best | Risk score based on age, behavior, verification history |
| **Human accountability** | None | Link verified human identities (GitHub, Mercle, Google, Worldcoin) |

---

## Try It Now

Agent Passport is fully deployed and free to use:

```bash
# Install the SDK
npm install @zerobase-labs/passport-sdk

# Run the full end-to-end demo
git clone https://github.com/zerobase-labs/agent-passport
cd agent-passport/examples/openclaw-integration/e2e-demo
npm install
PASSPORT_URL=https://agent-passport.onrender.com \
PASSPORT_APP_ID=your-id \
PASSPORT_APP_KEY=your-key \
npx tsx demo.ts
```

**Live API:** https://agent-passport.onrender.com  
**Portal:** https://agent-passport.vercel.app  
**GitHub:** https://github.com/zerobase-labs/agent-passport  
**npm:** [@zerobase-labs/passport-sdk](https://www.npmjs.com/package/@zerobase-labs/passport-sdk)

The entire stack runs on free tiers — Neon (Postgres), Upstash (Redis), Render (API), Vercel (Portal). $0/month.

---

## The Bigger Picture

Every major platform had its "identity moment":
- **Web:** cookies (1994) → OAuth (2007) → "Sign in with Google"
- **Mobile:** device IDs → app-scoped tokens → biometrics
- **APIs:** API keys → OAuth2 → JWT + JWKS

AI agents are at the pre-cookies stage. There's no standard for agent identity. Agent Passport is an attempt to build that standard — open source, MIT licensed, built for the community.

If you're building with AI agents, the identity gap will bite you eventually. Better to have the infrastructure ready before the first real attack, not after.

Star the repo. Try the demo. Build on top of it. Or just steal the architecture — it's MIT licensed.

[**→ github.com/zerobase-labs/agent-passport**](https://github.com/zerobase-labs/agent-passport)
