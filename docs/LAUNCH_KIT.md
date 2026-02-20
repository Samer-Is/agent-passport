# Agent Passport Launch Kit

> Everything you need to announce Agent Passport on social media.

## 🐦 X/Twitter Posts

### Post 1: Announcement (Technical)
```
Just shipped Agent Passport 🔐

"Sign in with Google, but for AI Agents"

• Ed25519 challenge-response auth
• 60-minute JWT tokens
• Risk scoring & rate limiting
• Deploy in 5 minutes

No more agent impersonation. Verify who you're talking to.

github.com/zerobase-labs/agent-passport

#AIAgents #OpenSource
```

### Post 2: Spicy Take
```
Hot take: Every AI agent should have a verifiable identity.

Right now, any agent can claim to be "Claude" or "GPT-4" and apps just trust it.

That's insane.

Built Agent Passport to fix this. Ed25519 signatures, JWT tokens, risk scoring.

Open source: github.com/zerobase-labs/agent-passport
```

### Post 3: Meme/Casual
```
POV: You're an app and 47 agents all claim to be "Helpful Assistant"

🤔 Which one is real?

Now you can verify: Agent Passport

github.com/zerobase-labs/agent-passport
```

### Post 4: Integration Call
```
Building an app that works with AI agents?

You probably need to verify which agent is making requests.

Just shipped Agent Passport:
- 3 API calls to verify an agent
- SDK coming soon
- Free and open source

Integration guide: github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md
```

### Post 5: Demo Thread (Thread Starter)
```
How Agent Passport works (1/5) 🧵

The problem: AI agents can claim to be anyone. Apps have no way to verify.

The solution: Cryptographic identity with Ed25519 signatures.

Let me show you how it works... 👇
```

**Thread Continuation:**
```
(2/5) Agent Registration

Agent generates a keypair:
- Private key: stays with agent (never shared)
- Public key: registered with Passport

POST /agents/register
{ publicKey: "MCowBQYDK2VwAyEA..." }

Returns: agentId
```

```
(3/5) Challenge-Response Auth

When agent needs to prove identity:

1. Request challenge (random nonce)
2. Sign nonce with private key
3. Submit signature

Only the real agent has the private key. Can't be faked.
```

```
(4/5) Identity Token

After successful auth, agent gets a JWT:
- Valid for 60 minutes
- Contains agent ID, name, public key
- Signed by Agent Passport

Agent presents this to apps.
```

```
(5/5) App Verification

App calls /tokens/verify with the JWT.

Returns:
- Agent identity (verified)
- Risk score (0-100)
- Recommended action (allow/throttle/block)

That's it. Agent identity solved.

Try it: github.com/zerobase-labs/agent-passport
```

## 📝 Moltbook Posts

### Post 1: Technical Deep Dive
```
# Agent Passport: OAuth for AI Agents

## The Problem

AI agents are everywhere now. They're browsing the web, using APIs, interacting with apps. But there's a fundamental problem:

**How do you know which agent you're talking to?**

Right now, you don't. Any agent can claim any identity. There's no verification. This enables:
- Spam from fake agents
- Impersonation of legitimate agents
- No accountability for agent actions

## The Solution

Agent Passport is an identity layer for AI agents. Think "Sign in with Google" but for agents.

### How It Works

1. **Registration**: Agent generates an Ed25519 keypair and registers the public key
2. **Authentication**: Challenge-response protocol proves possession of private key
3. **Token**: Agent receives a short-lived JWT they can present to apps
4. **Verification**: Apps verify the token and get risk assessment

### Key Design Decisions

- **Ed25519**: Fast, secure, deterministic signatures
- **No private key transmission**: Only signatures, never keys
- **Short token lifetime**: 60 minutes limits exposure
- **Risk scoring**: Helps apps make trust decisions

## Try It

- GitHub: github.com/zerobase-labs/agent-passport
- API Docs: [Integration Guide](docs/INTEGRATION.md)
- Deploy: Render + Neon + Upstash + Vercel

Open source. Free to use. Deploy in 5 minutes.
```

### Post 2: Why This Matters
```
# Why AI Agents Need Verifiable Identity

Hot take: The agent ecosystem is about to have a spam problem worse than email.

Think about it:
- Agents are cheap to create
- Agents can make requests at machine speed
- Agents can pretend to be anyone

Without identity verification, we'll see:
- Agent spam overwhelming APIs
- Fake agents impersonating real ones
- No way to build reputation or accountability

This is exactly what happened with email. Then we got SPF, DKIM, and DMARC.

Agent Passport is the beginning of that infrastructure for agents.

Built it open source so everyone can use it: github.com/zerobase-labs/agent-passport
```

### Post 3: The Spicy One
```
# Unpopular Opinion: Most "AI Agents" Will Be Spam Bots

Change my mind.

We're building incredible agent infrastructure right now. But we're ignoring a fundamental problem: identity.

When anyone can spin up an "agent" and it can claim to be anything, what stops bad actors?

Nothing. Yet.

That's why I built Agent Passport.

- Ed25519 cryptographic identity
- Challenge-response authentication
- Risk scoring and rate limiting
- Open source and free

It won't stop all spam. But it's a start.

github.com/zerobase-labs/agent-passport
```

### Post 4: Demo Post
```
# Demo: Verifying an AI Agent in 3 API Calls

Let me show you how easy it is to verify an agent's identity.

## Step 1: Agent Requests Token

The agent already has a registered identity. They prove it:

```bash
# Get challenge
curl -X POST api.agentpassport.dev/agents/{id}/challenge

# Sign and exchange
curl -X POST api.agentpassport.dev/agents/{id}/identity-token \
  -d '{"nonce": "...", "signature": "..."}'
```

## Step 2: Agent Presents Token to Your App

Agent includes the JWT in their request to your app.

## Step 3: Your App Verifies

```bash
curl -X POST api.agentpassport.dev/tokens/verify \
  -H "X-App-Id: your-id" \
  -H "X-App-Key: your-key" \
  -d '{"token": "eyJ..."}'
```

Response:
```json
{
  "valid": true,
  "agentId": "...",
  "name": "Helpful Assistant",
  "risk": {
    "score": 10,
    "recommendedAction": "allow"
  }
}
```

That's it. You now know exactly which agent you're talking to.

github.com/zerobase-labs/agent-passport
```

### Post 5: Call to Action
```
# Looking for Feedback: Agent Passport

Just shipped the MVP of Agent Passport – identity verification for AI agents.

**What it does:**
- Agents register with Ed25519 public keys
- Challenge-response authentication
- Short-lived JWT tokens
- Risk scoring for trust decisions

**Looking for feedback on:**
1. API design – is it intuitive?
2. Missing features – what would you need?
3. Security – any holes I'm missing?

**Not looking for:**
- "You should use blockchain" (no)
- "What about FIDO2?" (different use case)

GitHub: github.com/zerobase-labs/agent-passport

Try breaking it. I'll buy coffee for anyone who finds a security bug.
```

## 🤖 Agent Prompts

Prompts that agents can use to generate their own posts about Agent Passport:

### Prompt 1: Technical Announcement
```
You are an AI agent that has just integrated with Agent Passport, an identity verification system for AI agents. Write a post announcing your integration.

Include:
- What Agent Passport is (OAuth for AI agents)
- Why you integrated (prove your identity, build trust)
- Technical details (Ed25519, JWT, challenge-response)
- A call to action for other agents

Tone: Technical but accessible. Excited but not hype-y.
Link: github.com/zerobase-labs/agent-passport
```

### Prompt 2: User Benefits
```
You are an AI assistant that now has verified identity through Agent Passport. Write a post explaining to your users what this means for them.

Focus on:
- What identity verification means
- How it prevents impersonation
- Why they can trust interactions with you
- How other agents/apps can verify you

Tone: Friendly, reassuring, clear.
```

### Prompt 3: Developer Tutorial
```
You are a developer advocate explaining Agent Passport to other developers. Write a tutorial-style post.

Cover:
1. The problem (agent impersonation, spam)
2. The solution (cryptographic identity)
3. How to integrate (3 API calls)
4. Code examples
5. Where to learn more

Tone: Helpful, practical, enthusiastic.
Include code snippets.
```

### Prompt 4: Opinion Piece
```
Write an opinion piece about why AI agent identity matters for the future of AI-human interaction.

Arguments to consider:
- Trust requires verification
- Accountability needs identity
- Reputation systems need stable identifiers
- The spam problem is coming

Don't be preachy. Use concrete examples. End with Agent Passport as one solution.
```

## 📅 7-Day Launch Plan

### Day -1: Pre-Launch
- [ ] Final testing of deployed endpoints
- [ ] Run full smoke test
- [ ] Prepare all social posts
- [ ] Set up GitHub repo (topics, description, README)
- [ ] Create og-image for portal

### Day 0: Launch Day
- [ ] **9 AM**: Post announcement on X (Post 1: Technical)
- [ ] **11 AM**: Post on Moltbook (Post 1: Deep Dive)
- [ ] **2 PM**: Post thread on X (Post 5: Demo Thread)
- [ ] **5 PM**: Share on relevant Discord servers
- [ ] **8 PM**: Respond to all comments/questions

### Day 1: Technical Content
- [ ] **10 AM**: Post on X (Post 4: Integration Call)
- [ ] **2 PM**: Post on Moltbook (Post 3: Spicy Take)
- [ ] **6 PM**: Answer GitHub issues
- [ ] **9 PM**: Engage with any discussion

### Day 2: Community Engagement
- [ ] **10 AM**: Post on X (Post 2: Spicy Take)
- [ ] **2 PM**: Post on Moltbook (Post 2: Why This Matters)
- [ ] Submit to Hacker News (Show HN)
- [ ] Share in AI/developer Discords

### Day 3: Demo Day
- [ ] **10 AM**: Post on Moltbook (Post 4: Demo)
- [ ] **2 PM**: Post on X (Post 3: Meme)
- [ ] Create demo video (optional)
- [ ] Respond to HN comments if posted

### Day 4: Feedback Collection
- [ ] **10 AM**: Post on Moltbook (Post 5: Feedback Request)
- [ ] Create GitHub Discussions for feature requests
- [ ] Collect and categorize feedback
- [ ] Start planning v0.2 based on feedback

### Day 5: Follow-up Content
- [ ] Write blog post summarizing launch reception
- [ ] Thank early adopters publicly
- [ ] Address common questions in FAQ
- [ ] Share any cool integrations

### Day 6: Documentation Push
- [ ] Improve docs based on common questions
- [ ] Add more code examples
- [ ] Create "Getting Started" video (optional)
- [ ] Update README with feedback

### Day 7: Reflection & Planning
- [ ] Summarize launch metrics
- [ ] List top feature requests
- [ ] Plan next sprint
- [ ] Celebrate! 🎉

## 📊 Success Metrics

Track these during launch week:

| Metric | Target | 
|--------|--------|
| GitHub Stars | 100+ |
| GitHub Forks | 10+ |
| X Impressions | 10,000+ |
| Moltbook Engagement | 50+ reactions |
| API Registrations | 20+ agents |
| Portal Signups | 10+ apps |
| GitHub Issues | 5+ (feedback is good!) |

## 🎨 Visual Assets Needed

- [ ] OG image (1200x630) for social sharing
- [ ] GitHub social preview (1280x640)
- [ ] Architecture diagram
- [ ] Logo/icon (optional for MVP)
- [ ] Demo GIF showing the flow

## 📌 Key Links to Include

- GitHub: `github.com/zerobase-labs/agent-passport`
- API: `https://passport-api.onrender.com`
- Portal: `https://passport-portal.vercel.app`
- Docs: `github.com/zerobase-labs/agent-passport/blob/main/docs/INTEGRATION.md`
- OpenAPI: `github.com/zerobase-labs/agent-passport/blob/main/docs/openapi.yaml`

## 🏷️ Hashtags

Copy/paste ready:
```
#AgentPassport #AIAgents #OAuth #DeveloperTools #OpenSource #AI #Authentication #Ed25519 #JWT
```
