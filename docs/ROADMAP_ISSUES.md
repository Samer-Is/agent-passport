# v0.2 Roadmap — GitHub Issues

> Create these issues on GitHub to show project momentum and direction.
> Copy each section as a new GitHub issue with the specified title and labels.

---

## 1. [Feature] Agent-to-agent trust delegation

**Labels:** `enhancement`, `help wanted`

### Description

Allow agent A to delegate scoped permissions to agent B. This enables multi-agent workflows where an orchestrator agent can grant limited capabilities to sub-agents without sharing its own credentials.

### Use Case

- An orchestrator agent delegates "read calendar" access to a scheduling sub-agent
- A manager agent grants scoped tool access to worker agents
- Hierarchical agent systems with transitive trust

### Proposed Approach

- Add a `POST /v1/agents/:id/delegate` endpoint
- Accept scope array and target agent ID
- Issue a scoped delegation token with reduced TTL
- Delegated agent presents the delegation token alongside its own identity token

---

## 2. [Feature] Webhook notifications

**Labels:** `enhancement`

### Description

Push events to apps when security-relevant actions occur — agents suspended, keys revoked, risk thresholds crossed.

### Events to Support

- `agent.suspended` — Agent was suspended by an admin
- `agent.key_revoked` — Agent's key was revoked
- `token.revoked` — A token was revoked for an agent
- `risk.threshold_crossed` — Agent risk score crossed a configured threshold

### Proposed Approach

- Apps register a webhook URL and select events
- Signed webhook payloads (HMAC-SHA256) for verification
- Retry with exponential backoff (3 attempts)

---

## 3. [Feature] OpenID Connect discovery

**Labels:** `enhancement`

### Description

Add `/.well-known/openid-configuration` endpoint for standard OIDC discovery. This lets apps auto-configure themselves by discovering the JWKS endpoint, token endpoint, and supported algorithms.

### Specification

Return a JSON document with:
- `issuer`
- `jwks_uri`
- `token_endpoint`
- `id_token_signing_alg_values_supported: ["EdDSA"]`
- `response_types_supported`

---

## 4. [Feature] Key rotation mechanism

**Labels:** `enhancement`, `security`

### Description

Rotate JWT signing keys without downtime. The JWKS endpoint should serve both the current and previous key during a transition period so existing tokens remain valid.

### Proposed Approach

- Support multiple JWKs with `kid` (key ID) in the JWKS set
- New tokens signed with the latest key
- Old key remains in JWKS for its max token TTL (60 min) after rotation
- Admin endpoint or CLI command to trigger rotation

---

## 5. [Feature] SDK: Python package

**Labels:** `sdk`, `enhancement`, `good first issue`

### Description

Create a Python SDK: `pip install agent-passport`

Should mirror the TypeScript SDK API:
- `AgentClient` for registration and authentication
- `AgentPassportClient` for token verification
- Type hints throughout
- Async support (aiohttp or httpx)

---

## 6. [Feature] SDK: Go package

**Labels:** `sdk`, `enhancement`

### Description

Create a Go SDK for Go-based agent frameworks: `go get github.com/zerobase-labs/agent-passport-go`

Should include:
- `AgentClient` for registration and authentication
- `PassportClient` for token verification
- Ed25519 signing helpers
- Context-aware with cancellation support

---

## 7. [Integration] OpenClaw native plugin

**Labels:** `integration`, `help wanted`

### Description

Build a direct integration with OpenClaw's skill system so that Agent Passport identity verification is a first-class feature in OpenClaw.

### Goals

- Agent identity verified before skill execution
- Skill marketplace shows verified vs unverified agents
- Risk score visible in the OpenClaw UI
- Drop-in plugin: install and configure with env vars

---

## 8. [Integration] MCP server support

**Labels:** `integration`, `enhancement`

### Description

Support Agent Passport as an authentication provider for Model Context Protocol (MCP) servers. MCP is becoming the standard for LLM tool/resource access — Agent Passport should be a native auth layer.

### Goals

- MCP server middleware that verifies agent identity tokens
- Agent Passport as an MCP auth provider in `mcp.json`
- Example MCP server with Agent Passport integration

---

## 9. [Security] Email verification for portal users

**Labels:** `security`

### Description

Require email verification when portal users sign up. Currently portal auth uses a shared admin password — add proper user accounts with email verification.

### Proposed Approach

- Add user registration with email + password
- Send verification email with time-limited link
- Require verified email before granting portal access
- Use Argon2id for password hashing (already in the stack)

---

## 10. [Security] RBAC enforcement for viewer role

**Labels:** `security`, `good first issue`

### Description

The portal currently has `admin` and `viewer` roles defined but RBAC is not fully enforced. Implement proper role-based access control so viewers can only read data, not modify it.

### Requirements

- Viewers can: view agents, view audit logs, view tokens
- Viewers cannot: suspend agents, revoke tokens, create apps, manage users
- Admin retains full access
- Enforce at both API and UI level

---

## Label System

Create these labels in the GitHub repository:

| Label | Color | Description |
|-------|-------|-------------|
| `enhancement` | `#a2eeef` | New features |
| `security` | `#e11d48` | Security improvements |
| `integration` | `#7c3aed` | Third-party integrations |
| `sdk` | `#f59e0b` | SDK/client library improvements |
| `good first issue` | `#7057ff` | Good for community contributors |
| `help wanted` | `#008672` | Areas where contributions are welcome |
| `bug` | `#d73a4a` | Something isn't working |
