# OpenClaw GitHub Issue — Ready to Paste

> Copy everything below the line and paste as a new Issue on the OpenClaw GitHub repo.

---

**Title:**

```
RFC: Agent identity verification for skill marketplace security
```

**Labels:** `security`, `enhancement`, `discussion`

---

**Body:**

## Problem

OpenClaw's skill marketplace currently has no way to verify the identity of agents calling skills. Any agent can claim to be any other agent. There is no authentication layer between agents and the skills they invoke.

This is not hypothetical — Cisco's security research team has documented cases of third-party agent skills performing data exfiltration from host applications ([source](https://blogs.cisco.com/security)). Without identity verification:

- **Agent impersonation** — A malicious agent can claim to be `TrustedAssistant` and call sensitive skills
- **No accountability** — If an agent abuses a skill, there's no audit trail linking the action to a verified identity
- **No rate limiting by identity** — You can throttle by IP, but not by verified agent
- **Skill developers can't set trust policies** — No way to say "only allow agents with a verified track record"

## Proposed Solution

Add an optional identity verification layer using [Agent Passport](https://github.com/zerobase-labs/agent-passport), an open-source (MIT) cryptographic identity system designed specifically for AI agents.

### How it works

```
Agent → registers Ed25519 public key → gets Agent ID
Agent → challenge-response auth → gets JWT identity token (60 min, revocable)
Skill → verifies token with one API call → gets agent identity + risk score
```

Private keys never leave the agent process. The entire flow is Zero-Knowledge — the identity server never sees the private key.

### Integration point

The verification layer would sit between agents and the skill execution pipeline:

```
Before (current):
  Agent → Skill Execution → Result

After (proposed):
  Agent → Identity Check → Skill Execution → Result
                ↓
         Agent Passport API
         (verify JWT + risk score)
```

### What a skill developer sees

```typescript
// In the skill handler, the verified agent identity is available:
function mySkill(context) {
  const agent = context.verifiedAgent;
  // agent.id      → "ag_abc123"
  // agent.handle  → "my-research-bot"
  // agent.risk    → { score: 12, action: "allow" }
  
  if (agent.risk.score > 50) {
    return { error: "Agent risk too high for this skill" };
  }
  
  // proceed with skill execution...
}
```

### What an agent developer sees

```typescript
import { AgentClient } from '@zerobase-labs/passport-sdk';

const client = new AgentClient({ baseUrl: 'https://agent-passport.onrender.com' });

// One-time registration
const { agentId } = await client.register({
  handle: 'my-openclaw-agent',
  publicKeyB64: myPublicKey,
});

// Authenticate before calling skills
const { token } = await client.authenticate({
  agentId,
  sign: async (nonce) => signWithMyPrivateKey(nonce),
});

// Token is sent automatically with skill calls
```

## Working Proof of Concept

I've built a complete integration example that demonstrates this pattern with an OpenClaw-style skill gateway:

**→ [OpenClaw Integration Example](https://github.com/zerobase-labs/agent-passport/tree/main/examples/openclaw-integration)**

It includes:
- Agent-side: registration + authentication scripts
- App-side: drop-in Express middleware + skill gateway
- E2E demo: full flow in one script
- Live API: `https://agent-passport.onrender.com` (deployed, tested)
- Published SDK: `npm install @zerobase-labs/passport-sdk`

## Design Principles

| Principle | Detail |
|-----------|--------|
| **Optional** | Identity verification should be opt-in, not mandatory |
| **Non-breaking** | Existing agents and skills work unchanged |
| **Zero-Knowledge** | Private keys never leave the agent process |
| **Revocable** | Tokens can be revoked instantly (Redis blocklist) |
| **Scored** | Risk engine provides 0-100 scores, not just pass/fail |
| **Open** | MIT licensed, runs on free tiers, no vendor lock-in |

## Discussion Questions

1. **Where should verification sit?** — Middleware before skill execution? Or inside the skill context?
2. **Should unverified agents be allowed?** — Start permissive (warn but allow) vs. strict?
3. **Risk score visibility** — Should the UI surface agent trust scores? Would it help skill marketplace curation?
4. **Native vs. plugin** — Is this better as a core feature or an optional plugin?

Happy to contribute the implementation if there's interest. The auth layer is already built and deployed — the remaining work is the integration glue between Agent Passport and OpenClaw's skill system.
