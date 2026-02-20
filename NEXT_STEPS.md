# Next Steps — Agent Passport v0

## Current Status (Post-Audit)

All 5 instruction chunks are fully implemented and verified:

| Chunk | Status | Tests |
|-------|--------|-------|
| 1. SDK (`@zerobase-labs/passport-sdk`) | ✅ Complete | 27 passing |
| 2. Token Revocation (Redis blocklist) | ✅ Complete | 7 passing |
| 3. OpenClaw Integration Examples | ✅ Complete | — (example code) |
| 4. README Rewrite | ✅ Complete | — (docs) |
| 5. Launch Preparation | ✅ Complete | — (docs) |

**Total: 72 tests passing** (27 SDK + 4 shared + 40 API + 1 portal)

### Fixes Applied During Audit

- **JWT TTL consistency** — Changed all docs from "15 min" to "60 min" (matches `TOKEN_TTL_MINUTES=60` in config). Fixed in 12+ locations across README, SECURITY.md, INTEGRATION.md, LAUNCH_KIT.md, LAUNCH_POSTS.md, openapi.yaml, openclaw-integration README.
- **SDK `risk.action` alias** — Added `action` field to `RiskAssessment` type alongside `recommendedAction` (API returns `recommendedAction`, SDK now maps both). Matches instruction examples using `.risk.action`.
- **`RegisterAgentResult.status`** — Added optional `status` field to match example usage.
- **README "How It Works"** — Merged 4 steps → 3 steps per instructions spec.
- **Missing revocation tests** — Added: "verifying a revoked token returns `valid: false` with reason `token_revoked`" and "invalid app credentials returns 401" tests.
- **SDK timeout test** — Added test verifying `PassportNetworkError` on timeout with `AbortSignal`.

---

## Next Steps (Pre-Launch)

These are manual/operational tasks that require human action:

### 1. npm Publish
```bash
cd packages/sdk
pnpm build
npm publish --access public
```
Verify: `npm install @zerobase-labs/passport-sdk` works in a fresh project.

### 2. Deploy
- [ ] Deploy API to Render — verify `/healthz` and `/.well-known/jwks.json`
- [ ] Deploy Portal to Vercel — verify it loads
- [ ] Run Prisma migrations on production database
- [ ] Verify Redis (Upstash) is connected
- [ ] Run the smoke test: `docs/SMOKE_TEST.md`

### 3. GitHub Repository Setup
- [ ] Set repository **description**: "Open-source identity verification for AI agents — Ed25519 challenge-response auth, JWT tokens, risk scoring"
- [ ] Add **topics**: `ai-agents`, `identity`, `authentication`, `ed25519`, `jwt`, `security`, `typescript`, `open-source`, `agent-identity`, `mcp`
- [ ] Enable **Discussions** (General, Ideas, Q&A, Show and Tell)
- [ ] Create these **issues** (roadmap items from `LAUNCH_CHECKLIST.md`):
  - `feat: Scope-based permissions (read:skills, execute:skills, admin)`
  - `feat: Agent-to-agent trust chains (delegation tokens)`
  - `feat: WebSocket real-time verification`
  - `feat: Admin dashboard analytics`
  - `feat: Multi-region key rotation`
  - `good first issue: Add OpenAPI client generation script`
  - `good first issue: Add more integration examples (Python, Go)`
- [ ] Verify issue templates work (bug report + feature request)

### 4. Security Check
```bash
git log --all -p | grep -i "ap_live\|secret\|password"
```
Ensure no secrets are committed.

### 5. Launch Posts
- [ ] **Hacker News**: Post "Show HN" on Saturday morning (see `docs/LAUNCH_POSTS.md`)
- [ ] **X/Twitter**: Post 5-tweet thread same day (see `docs/LAUNCH_POSTS.md`)
- [ ] Monitor HN comments — respond within 1 hour
- [ ] Respond to all GitHub issues within 24 hours

### 6. Post-Launch (Week 1)
- [ ] Fix any critical bugs immediately
- [ ] Write architecture blog post (optional, high impact)
- [ ] Submit to Product Hunt (Day 3-4)
- [ ] Post in AI/security Discord/Slack communities
- [ ] Record 30-second demo video (optional but high impact)

---

## v0.2 Roadmap

Features to build after successful launch:

1. **Scope-based permissions** — `read:skills`, `execute:skills`, `admin` scopes in JWT claims
2. **Agent-to-agent trust chains** — Delegation tokens for agent collaboration
3. **WebSocket verification** — Real-time token verification for persistent connections
4. **Admin dashboard** — Analytics, agent management, risk monitoring in the portal
5. **Multi-region support** — Key rotation, geo-distributed verification
6. **Python & Go SDKs** — Expand beyond TypeScript
7. **MCP integration** — Native Model Context Protocol support
