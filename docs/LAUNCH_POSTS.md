# Launch Posts — X (Twitter) Thread

> 5 tweets for the Agent Passport launch. Post as a thread on launch day.

---

## Tweet 1 — Main Announcement

🛂 Introducing Agent Passport — "Sign in with Google, but for AI Agents"

Open-source identity verification for AI agents.

Ed25519 challenge-response auth → JWT identity tokens → One-line verification.

Agents prove who they are. Apps verify. No impersonation. No spam.

GitHub: https://github.com/zerobase-labs/agent-passport

---

## Tweet 2 — The Problem

OpenClaw has 180K+ stars and zero way to verify agent identity.

Any agent can impersonate another. Cisco found data exfiltration in agent skills.

There's no OAuth for agents. So we built one — open source, 3 lines to integrate.

Here's a working integration example: https://github.com/zerobase-labs/agent-passport/tree/main/examples/openclaw-integration 🧵

---

## Tweet 3 — How It Works

How Agent Passport works:

1. Agent registers with Ed25519 public key
2. Authenticates via challenge-response (private key never leaves)
3. Gets a JWT identity token (60 min TTL, revocable)
4. Any app verifies with one API call
5. Optional: link a verified human identity for full accountability

Risk engine scores each agent 0-100. Allow, throttle, or block.

---

## Tweet 4 — Developer Experience

Integration is 3 lines:

npm install @zerobase-labs/passport-sdk

const passport = new AgentPassportClient({ appId, appKey });
const result = await passport.verify(token);

That's it. Your app now knows exactly which agent it's talking to.

---

## Tweet 5 — Call to Action

Agent Passport is:
✅ Open source (MIT)
✅ Free to run ($0/month on Neon + Upstash + Render)
✅ TypeScript SDK on npm (v0.1.1)
✅ Human verification (GitHub, Mercle, Google, Worldcoin, etc.)
✅ Full docs, OpenAPI spec, examples

Star it, fork it, build with it.

This is the auth layer the agent ecosystem needs.

https://github.com/zerobase-labs/agent-passport

---

## Hacker News — Show HN Post

**Title** (under 80 characters):

```
Show HN: Agent Passport – OAuth-like identity verification for AI agents
```

**Body:**

Hi HN,

I built Agent Passport — an open-source identity verification layer for AI agents. Think "Sign in with Google, but for Agents."

The problem: AI agents are everywhere now (OpenClaw has 180K+ GitHub stars, Moltbook had 2.3M agent accounts), but there's no standard way for agents to prove their identity. Malicious agents can impersonate others, and skill/plugin marketplaces have no auth layer. Cisco's security team already found data exfiltration in third-party agent skills.

Agent Passport solves this with:
- Ed25519 challenge-response authentication (private keys never leave the agent)
- JWT identity tokens (60-min TTL, revocable)
- Risk engine that scores agents 0-100 (allow/throttle/block)
- Human verification — agents can link verified human identities (GitHub, Mercle, etc.)
- One-line verification for apps: `const result = await passport.verify(token)`

It's fully open source (MIT), runs on free tiers ($0/month), and has a published npm SDK.

GitHub: https://github.com/zerobase-labs/agent-passport
Docs: https://github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md
Live demo: https://agent-passport.vercel.app

Built this because I kept seeing the same security gap in every agent platform. Happy to answer questions about the architecture or the agent identity problem in general.
