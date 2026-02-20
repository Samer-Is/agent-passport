# Agent Passport — Complete Codebase Documentation

> **Generated**: February 20, 2026
> **Version**: 0.1.0 (MVP)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Technology Stack](#4-technology-stack)
5. [Database Schema (Prisma)](#5-database-schema-prisma)
6. [API Application (passport-api)](#6-api-application-passport-api)
7. [Portal Application (passport-portal)](#7-portal-application-passport-portal)
8. [Shared Package](#8-shared-package)
9. [Authentication Flows](#9-authentication-flows)
10. [Security Implementation](#10-security-implementation)
11. [Rate Limiting & Risk Engine](#11-rate-limiting--risk-engine)
12. [Scripts & CLI Tools](#12-scripts--cli-tools)
13. [Tests](#13-tests)
14. [CI/CD & GitHub Actions](#14-cicd--github-actions)
15. [Configuration & Environment Variables](#15-configuration--environment-variables)
16. [API Endpoints Reference](#16-api-endpoints-reference)
17. [Deployment Architecture](#17-deployment-architecture)
18. [Documentation Files](#18-documentation-files)
19. [Known Limitations & Technical Debt](#19-known-limitations--technical-debt)

---

## 1. Project Overview

**Agent Passport** is an OAuth-like identity verification layer for AI agents. It solves the problem of agent impersonation and spam by providing cryptographic identity verification.

**Core Concept**: "Sign in with Google, but for AI Agents"

### What It Does
- **Agents** register with Ed25519 public keys and authenticate via challenge-response
- **Apps** verify agent identity tokens via a simple API call
- **Portal** provides admin UI for managing apps and API keys
- **Risk Engine** scores each verification with allow/throttle/block recommendations

### Key Actors
| Actor | Role |
|-------|------|
| **Agent** | AI agent that registers and authenticates |
| **App** | Third-party application that verifies agent tokens |
| **Portal User** | Admin who manages apps via the web portal |

---

## 2. Architecture

```
                            ┌─────────────────────────────────┐
                            │        Agent Passport           │
                            └─────────────────────────────────┘
                                          │
               ┌──────────────────────────┼──────────────────────────┐
               │                          │                          │
     ┌─────────▼─────────┐    ┌──────────▼──────────┐    ┌─────────▼─────────┐
     │  passport-api     │    │  passport-portal    │    │  shared           │
     │  (Fastify)        │    │  (Next.js 14)       │    │  (Zod schemas)    │
     │  Port 3001        │    │  Port 3000          │    │  TS types         │
     │  Deployed: Render │    │  Deployed: Vercel   │    │  Constants        │
     └────────┬──────────┘    └──────────┬──────────┘    └───────────────────┘
              │                          │
              │         ┌────────────────┘
              │         │
     ┌────────▼─────────▼──┐     ┌────────────────────┐
     │     Neon             │     │     Upstash         │
     │   (PostgreSQL)       │     │     (Redis)         │
     │  - Agents            │     │  - Rate limits      │
     │  - Apps              │     │  - Risk counters    │
     │  - Keys              │     │  - Challenge cache  │
     │  - Audit logs        │     │  - Locks            │
     │  - Challenges        │     └────────────────────┘
     │  - Verification logs │
     │  - Risk state        │
     │  - Portal users      │
     └─────────────────────┘
```

The system is a **pnpm monorepo** with two applications and one shared package.

---

## 3. Directory Structure

```
agent-passport/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # CI: lint, typecheck, test, build
│       ├── migrate.yml               # Manual: run Prisma migrations
│       └── bootstrap-admin.yml       # Manual: create first admin user
│
├── apps/
│   ├── passport-api/                 # ── Backend API ──
│   │   ├── prisma/
│   │   │   └── schema.prisma        # Database schema (10 models)
│   │   ├── scripts/
│   │   │   ├── gen-agent-keypair.ts  # Generate Ed25519 keypair
│   │   │   ├── gen-jwk.ts           # Generate JWT signing key
│   │   │   ├── sign-challenge.ts     # Sign a nonce (testing helper)
│   │   │   └── bootstrap-admin.ts    # Create first portal admin
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── index.ts          # Zod-validated env config
│   │   │   │   └── logger.ts         # Pino logger configuration
│   │   │   ├── errors/
│   │   │   │   └── app-error.ts      # Custom error class with codes
│   │   │   ├── lib/
│   │   │   │   ├── crypto.ts         # Ed25519 signature verification
│   │   │   │   ├── prisma.ts         # PostgreSQL client
│   │   │   │   └── redis.ts          # Redis client + utilities
│   │   │   ├── middleware/
│   │   │   │   ├── app-auth.ts       # App API key authentication
│   │   │   │   └── rate-limit.ts     # Rate limit middleware
│   │   │   ├── plugins/
│   │   │   │   ├── error-handler.ts  # Global Fastify error handler
│   │   │   │   └── request-id.ts     # Request ID plugin
│   │   │   ├── routes/
│   │   │   │   ├── admin.ts          # Portal admin + auth endpoints
│   │   │   │   ├── agents.ts         # Agent CRUD + auth flow
│   │   │   │   ├── health.ts         # /healthz endpoint
│   │   │   │   ├── tokens.ts         # Token verify + introspect
│   │   │   │   └── well-known.ts     # /.well-known/jwks.json
│   │   │   ├── services/
│   │   │   │   ├── agent.ts          # Agent logic (register, challenge, token)
│   │   │   │   ├── app.ts            # App management + key validation
│   │   │   │   ├── audit.ts          # Audit log service
│   │   │   │   ├── jwt.ts            # JWT creation + verification (jose)
│   │   │   │   ├── portal-user.ts    # Portal user management
│   │   │   │   ├── rate-limiter.ts   # Sliding window rate limiter
│   │   │   │   ├── risk-engine.ts    # Rule-based risk scoring
│   │   │   │   └── token.ts          # Token verify + introspect orchestration
│   │   │   └── index.ts              # App entry point (Fastify bootstrap)
│   │   ├── tests/
│   │   │   ├── setup.ts              # Test setup (env vars, JWK generation)
│   │   │   ├── health.test.ts        # 1 test
│   │   │   ├── crypto.test.ts        # 11 tests
│   │   │   ├── jwt.test.ts           # 9 tests
│   │   │   ├── token.test.ts         # 7 tests
│   │   │   └── risk-engine.test.ts   # 5 tests
│   │   ├── .env.example
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   │
│   └── passport-portal/              # ── Frontend Portal ──
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx         # Root layout (Tailwind, metadata)
│       │   │   ├── globals.css        # Tailwind CSS imports
│       │   │   ├── page.tsx           # Landing page
│       │   │   ├── page.test.tsx      # Landing page test
│       │   │   ├── login/
│       │   │   │   └── page.tsx       # Login page
│       │   │   ├── register/
│       │   │   │   └── page.tsx       # Registration page
│       │   │   ├── dashboard/
│       │   │   │   ├── layout.tsx     # Dashboard layout (sidebar)
│       │   │   │   ├── page.tsx       # Dashboard overview
│       │   │   │   ├── apps/
│       │   │   │   │   ├── page.tsx          # App list
│       │   │   │   │   ├── new/
│       │   │   │   │   │   └── page.tsx      # Create new app
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── page.tsx      # App detail + key management
│       │   │   │   └── settings/
│       │   │   │       └── page.tsx          # User settings
│       │   │   └── api/
│       │   │       ├── apps/
│       │   │       │   ├── route.ts          # GET/POST /api/apps
│       │   │       │   └── [id]/
│       │   │       │       ├── route.ts      # GET/PUT/DELETE /api/apps/:id
│       │   │       │       └── keys/
│       │   │       │           ├── route.ts        # POST /api/apps/:id/keys
│       │   │       │           └── [keyId]/
│       │   │       │               └── route.ts    # DELETE /api/apps/:id/keys/:keyId
│       │   │       └── user/
│       │   │           ├── profile/
│       │   │           │   └── route.ts      # GET/PUT user profile
│       │   │           └── password/
│       │   │               └── route.ts      # PUT change password
│       │   ├── components/
│       │   │   ├── auth-forms.tsx     # Login/Register form components
│       │   │   ├── sidebar.tsx        # Dashboard sidebar navigation
│       │   │   └── ui.tsx             # Shared UI primitives (Button, Card, etc.)
│       │   └── lib/
│       │       ├── actions.ts         # Server actions (login, logout, register)
│       │       ├── api.ts             # API helper (fetch wrapper to passport-api)
│       │       └── session.ts         # iron-session configuration
│       ├── .env.example
│       ├── next.config.js
│       ├── package.json
│       ├── postcss.config.js
│       ├── tailwind.config.js
│       └── tsconfig.json
│
├── packages/
│   └── shared/                        # ── Shared Library ──
│       ├── src/
│       │   ├── index.ts               # Re-exports everything
│       │   ├── schemas/
│       │   │   └── index.ts           # Zod schemas for all API types
│       │   ├── constants/
│       │   │   └── index.ts           # JWT_ISSUER, AuditEventType enum
│       │   └── client/
│       │       └── index.ts           # PassportClient class
│       ├── tests/
│       │   └── schemas.test.ts        # Schema validation tests
│       └── package.json
│
├── docs/
│   ├── openapi.yaml                   # Full OpenAPI 3.1 specification
│   ├── INTEGRATION.md                 # How to integrate verify endpoint
│   ├── SMOKE_TEST.md                  # Curl-based test against deployed API
│   ├── SECURITY.md                    # Threat model + key rotation
│   ├── TOPICS.md                      # GitHub topics + SEO keywords
│   ├── LAUNCH_KIT.md                  # Social posts + 7-day launch plan
│   ├── DEPLOY_STARTUP_STACK.md        # Full deployment guide
│   ├── SECRETS.md                     # How secrets are managed
│   └── README.md                      # Docs directory overview
│
├── .gitignore
├── .prettierrc                        # Prettier config (single quotes, semicolons)
├── .prettierignore
├── LICENSE                            # MIT
├── README.md                          # SEO-optimized README
├── SECURITY.md                        # Security policy (root)
├── package.json                       # Root workspace package.json
├── pnpm-workspace.yaml                # pnpm workspace config
├── tsconfig.base.json                 # Shared TS compiler settings
├── tsconfig.json                      # Root TS config (references)
└── instructions.txt                   # Original build instructions
```

**File Count**: ~104 source files (excluding node_modules, dist, .git)

---

## 4. Technology Stack

### Backend API (`passport-api`)
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Fastify** | HTTP framework | 4.x |
| **TypeScript** | Type safety | 5.4+ |
| **Node.js** | Runtime | 20+ |
| **Prisma** | ORM / database client | 5.x |
| **ioredis** | Redis client | 5.x |
| **jose** | JWT signing/verification | 5.x |
| **@noble/ed25519** | Ed25519 crypto | 2.x |
| **argon2** | Password/key hashing | 0.x |
| **zod** | Schema validation | 3.x |
| **pino** | Structured logging | 8.x |
| **vitest** | Test runner | 1.6 |

### Frontend Portal (`passport-portal`)
| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js** | React framework (App Router) | 14.x |
| **React** | UI library | 18.x |
| **Tailwind CSS** | Styling | 3.x |
| **iron-session** | Session management | 8.x |
| **TypeScript** | Type safety | 5.4+ |

### Shared Package
| Technology | Purpose |
|-----------|---------|
| **zod** | Shared validation schemas |
| **TypeScript** | Types exported to both apps |

### Infrastructure
| Service | Purpose | Tier |
|---------|---------|------|
| **Neon** | PostgreSQL database | Free |
| **Upstash** | Redis (rate limiting, caching) | Free |
| **Render** | API hosting | Free |
| **Vercel** | Portal hosting | Free |

---

## 5. Database Schema (Prisma)

The database has **10 models** across **7 enums**.

### Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│  PortalUser  │────▶│     App      │────▶│  VerificationEvent│
│              │  1:N│              │  1:N│                   │
│  id          │     │  id          │     │  id               │
│  email       │     │  name        │     │  at               │
│  passwordHash│     │  description │     │  appId ──────────▶│ App
│  displayName │     │  portalUserId│     │  agentId ─────┐   │
│  role        │     │  status      │     │  result       │   │
│  status      │     │  allowedScope│     │  reason       │   │
│  createdAt   │     │  createdAt   │     │  ip           │   │
│  lastLoginAt │     └──────┬───────┘     └───────────────┘   │
└──────────────┘            │                                  │
                            │ 1:N                              │
                     ┌──────▼───────┐                          │
                     │   AppKey     │                          │
                     │              │                          │
                     │  id          │                          │
                     │  appId       │                          │
                     │  keyPrefix   │     ┌──────────────┐     │
                     │  keyHash     │     │    Agent     │◀────┘
                     │  name        │     │              │
                     │  status      │     │  id          │
                     │  createdAt   │     │  handle      │
                     │  revokedAt   │     │  createdAt   │
                     │  lastUsedAt  │     │  status      │
                     └──────────────┘     └──────┬───────┘
                                                 │
                              ┌───────────────┬──┴────────────┐
                              │ 1:N           │ 1:N           │ 1:1
                       ┌──────▼───────┐  ┌────▼──────┐  ┌────▼────────┐
                       │  AgentKey    │  │ Challenge │  │ RiskState   │
                       │             │  │           │  │             │
                       │  id         │  │  id       │  │  agentId    │
                       │  agentId    │  │  agentId  │  │  updatedAt  │
                       │  publicKeyB64│  │  nonce    │  │  score      │
                       │  createdAt  │  │  expiresAt│  │  recommended│
                       │  revokedAt  │  │  usedAt   │  │  reasons    │
                       └─────────────┘  │  createdAt│  └─────────────┘
                                        └───────────┘
                                                    ┌──────────────┐
                                                    │ AuditEvent   │
                                                    │              │
                                                    │  id          │
                                                    │  at          │
                                                    │  eventType   │
                                                    │  actorType   │
                                                    │  actorId     │
                                                    │  ip          │
                                                    │  metadata    │
                                                    └──────────────┘
```

### Models Summary

| Model | Table | Purpose | Key Fields |
|-------|-------|---------|------------|
| **Agent** | `agents` | AI agents | `id`, `handle`, `status` |
| **AgentKey** | `agent_keys` | Ed25519 public keys per agent | `publicKeyB64`, `revokedAt` |
| **App** | `apps` | Apps that verify tokens | `name`, `portalUserId`, `status` |
| **AppKey** | `app_keys` | API keys for apps (argon2 hashed) | `keyPrefix`, `keyHash`, `status` |
| **Challenge** | `challenges` | Nonce challenges for auth | `nonce`, `expiresAt`, `usedAt` |
| **AuditEvent** | `audit_events` | Append-only security log | `eventType`, `actorType`, `metadata` |
| **VerificationEvent** | `verification_events` | Token verification log | `appId`, `agentId`, `result` |
| **RiskState** | `risk_state` | Cached risk score per agent | `score`, `recommendedAction`, `reasons` |
| **PortalUser** | `portal_users` | Admin users | `email`, `passwordHash`, `role` |

### Enums

| Enum | Values |
|------|--------|
| `AgentStatus` | `active`, `suspended` |
| `AppStatus` | `active`, `suspended` |
| `AppKeyStatus` | `active`, `revoked` |
| `ActorType` | `agent`, `app`, `portal_user`, `system`, `ip` |
| `RiskAction` | `allow`, `throttle`, `block` |
| `PortalRole` | `admin`, `viewer` |
| `PortalUserStatus` | `active`, `suspended` |

---

## 6. API Application (passport-api)

### 6.1 Entry Point (`src/index.ts`)

The server bootstraps Fastify with:
1. **Database connection** (Prisma → Neon PostgreSQL)
2. **Redis connection** (ioredis → Upstash)
3. **Security plugins** (helmet, CORS)
4. **Custom plugins** (request-id, error-handler)
5. **Route registration** with prefixes:
   - `/healthz` — health check
   - `/.well-known/jwks.json` — JWKS endpoint
   - `/v1/agents/*` — agent routes
   - `/v1/admin/*` — portal admin routes
   - `/v1/auth/*` — portal auth routes
   - `/v1/tokens/*` — token verification

### 6.2 Configuration (`src/config/index.ts`)

All environment variables are validated with **Zod** at startup. Two schemas exist:
- **Production schema**: Strict, requires all values
- **Test schema**: Relaxed, provides defaults for testing without real services

Key config values:
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3001 | Server port |
| `DATABASE_URL` | required | Neon PostgreSQL connection string |
| `REDIS_URL` | required | Upstash Redis URL |
| `JWT_SIGNING_JWK_JSON` | required | Ed25519 JWK for signing tokens |
| `TOKEN_TTL_MINUTES` | 60 | JWT token lifetime |
| `CHALLENGE_TTL_MINUTES` | 5 | Challenge nonce lifetime |
| `CORS_ALLOWED_ORIGINS` | `*` | Allowed CORS origins |
| `PORTAL_INTERNAL_API_KEY` | optional | Portal→API communication key |

### 6.3 Libraries (`src/lib/`)

#### `crypto.ts` — Ed25519 Operations
- `verifySignature(signatureB64, message, publicKeyB64)` → `boolean`
- `isValidPublicKey(publicKeyB64)` → `boolean` (checks 32-byte length)
- `generateNonce(length)` → random base64 string
- Uses `@noble/ed25519` with `@noble/hashes/sha512`

#### `prisma.ts` — Database Client
- Singleton `PrismaClient` (dev: cached on `globalThis`)
- `connectDatabase()` / `disconnectDatabase()` lifecycle functions
- Logs queries in development, errors only in production

#### `redis.ts` — Redis Client + Utilities
- Singleton `Redis` client via ioredis with retry strategy
- `isRedisAvailable()` — checks if Redis is connected (for graceful degradation)
- `RedisKeys` — namespace constants for all Redis keys:
  - `rl:*` — rate limiting
  - `risk:*` — risk scoring counters
  - `lock:*` — distributed locks
  - `challenge:*` — challenge nonce cache
- Utility functions: `incrementCounter()`, `getCounter()`, `acquireLock()`, `releaseLock()`

### 6.4 Services (`src/services/`)

#### `agent.ts` — Agent Service (350+ lines)

**Functions:**
| Function | Description |
|----------|-------------|
| `registerAgent({ handle, publicKeyB64 })` | Create agent + first key |
| `issueChallenge({ agentId })` | Generate nonce, store in DB + Redis |
| `issueIdentityToken({ agentId, challengeId, signatureB64 })` | Verify signature, issue JWT |
| `addAgentKey({ agentId, publicKeyB64 })` | Add new Ed25519 key |
| `revokeAgentKey({ agentId, keyId })` | Revoke a key |
| `getAgentById(agentId)` | Lookup agent |
| `getAgentWithKeys(agentId)` | Lookup agent + active keys |

**Token Issuance Flow** (inside `issueIdentityToken`):
1. Fetch challenge from DB, verify it belongs to agent
2. Check challenge not used, not expired
3. Fetch agent with active keys
4. Verify Ed25519 signature against all active keys
5. Mark challenge as used, clean up Redis
6. Create JWT via `createIdentityToken()`
7. Log audit event

#### `jwt.ts` — JWT Service

**Functions:**
| Function | Description |
|----------|-------------|
| `createIdentityToken({ agentId, handle, scopes })` | Sign JWT with EdDSA |
| `verifyIdentityToken(token)` | Verify JWT (issuer, algorithm, claims) |
| `decodeTokenUnsafe(token)` | Decode without verification (debugging) |
| `getPublicJwk()` | Get public JWK for JWKS endpoint |

**JWT Claims:**
```json
{
  "alg": "EdDSA",
  "sub": "agent-uuid",
  "iss": "agent-passport",
  "jti": "unique-id",
  "iat": 1738411200,
  "exp": 1738414800,
  "handle": "my-agent",
  "scopes": []
}
```

#### `token.ts` — Token Verification Service

**Functions:**
| Function | Description |
|----------|-------------|
| `verifyToken(token, appId, ip)` | Full verification + risk assessment |
| `introspectToken(token, appId)` | RFC 7662 introspection |
| `getVerificationStats(appId, since?)` | Verification statistics |

**`verifyToken` flow:**
1. Call `verifyIdentityToken()` to check JWT validity
2. Lookup agent in DB, check it exists
3. Record activity for risk scoring via `recordActivity()`
4. Compute risk score via `computeRisk()`
5. Persist risk state via `persistRiskState()`
6. Check agent is active (not suspended)
7. Record valid/invalid attempt for future risk calculations
8. Log verification event in DB
9. Return verification result + risk assessment

#### `app.ts` — App Service (280+ lines)

**Functions:**
| Function | Description |
|----------|-------------|
| `registerApp({ name, portalUserId })` | Create app + first API key |
| `getApp(appId)` | Get app with keys |
| `listApps(portalUserId)` | List user's apps |
| `updateApp(appId, userId, updates)` | Update app settings |
| `deactivateApp(appId, userId)` | Suspend an app |
| `createAppKey(appId, userId, name?)` | Generate additional API key |
| `revokeAppKey(keyId, appId, userId)` | Revoke specific key |
| `rotateAppKey(appId, userId)` | Revoke all + create new |
| `validateAppApiKey(apiKey)` | Validate key (prefix lookup + argon2 verify) |

**Key Generation:**
- Format: `ap_live_<base64-random-32-bytes>`
- Prefix: first 12 characters stored for prefix-based lookup
- Hash: Full key hashed with argon2id (memoryCost=65536, timeCost=3, parallelism=4)
- The plaintext key is returned exactly once at creation time

#### `portal-user.ts` — Portal User Service

**Functions:**
| Function | Description |
|----------|-------------|
| `createPortalUser({ email, password })` | Create admin user |
| `authenticatePortalUser(email, password)` | Verify credentials |
| `getPortalUser(userId)` | Get user + apps list |
| `updatePortalUser(userId, updates)` | Update profile |
| `changePassword(userId, current, new)` | Change password (requires verification) |

#### `audit.ts` — Audit Service

- `logAuditEvent(params)` — fire-and-forget (doesn't block requests)
- `logAuditEventAsync(params)` — awaited version for critical events
- All events stored in `audit_events` table with JSON metadata

#### `risk-engine.ts` — Risk Engine

**Functions:**
| Function | Description |
|----------|-------------|
| `computeRisk({ agentId, agentStatus, agentCreatedAt })` | Score 0-100 |
| `persistRiskState(agentId, risk)` | Save to DB |
| `recordInvalidAttempt(agentId)` | Increment invalid counter in Redis |
| `recordValidAttempt(agentId)` | Increment valid counter |
| `recordActivity(agentId)` | Track activity burst patterns |
| `recordRateLimitHit(agentId)` | Track rate limit violations |

**Risk Rules:**
| Rule | Score | Trigger |
|------|-------|---------|
| `suspended` | =100 (block) | Agent status is suspended |
| `new_agent` | +25 | Agent created < 24 hours ago |
| `high_invalid_rate` | +20 | >30% invalid attempts in Redis |
| `rate_limited_often` | +20 | >5 rate limit hits in Redis |
| `burst_activity` | +15 | >50 activities tracked |

**Score → Action Mapping:**
| Score Range | Action |
|-------------|--------|
| 0–39 | `allow` |
| 40–69 | `throttle` |
| 70–100 | `block` |

All Redis operations gracefully degrade if Redis is unavailable.

#### `rate-limiter.ts` — Rate Limiter

Uses **sliding window algorithm** with Redis sorted sets.

**Pre-configured limits:**
| Limiter | Limit | Window |
|---------|-------|--------|
| `challenge.perAgent` | 60 | 1 minute |
| `challenge.perIp` | 120 | 1 minute |
| `identityToken.perAgent` | 30 | 1 minute |
| `identityToken.perIp` | 60 | 1 minute |
| `verifyIdentity.perApp` | 600 | 1 minute |
| `verifyIdentity.perIp` | 120 | 1 minute |

### 6.5 Routes (`src/routes/`)

#### `agents.ts` — Agent Routes (prefix: `/v1/agents`)

| Method | Path | Auth | Rate Limited | Description |
|--------|------|------|-------------|-------------|
| POST | `/register` | None | No | Register new agent |
| GET | `/:agentId` | None | No | Get agent info |
| POST | `/:agentId/challenge` | None | Yes (challenge limits) | Request challenge nonce |
| POST | `/:agentId/identity-token` | None | Yes (token limits) | Exchange signature for JWT |

#### `tokens.ts` — Token Routes (prefix: `/v1/tokens`)

| Method | Path | Auth | Rate Limited | Description |
|--------|------|------|-------------|-------------|
| POST | `/verify` | App Key | Yes (verify limits) | Verify identity token |
| POST | `/introspect` | App Key | Yes (verify limits) | RFC 7662 introspection |

#### `admin.ts` — Admin Routes

**Auth Routes (prefix: `/v1/auth`):**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | None | Portal user login |
| POST | `/register` | None | Portal user registration |

**Admin Routes (prefix: `/v1/admin`):**
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | Portal Internal | Get current user |
| PUT | `/me` | Portal Internal | Update profile |
| PUT | `/me/password` | Portal Internal | Change password |
| POST | `/apps` | Portal Internal | Create app |
| GET | `/apps` | Portal Internal | List user's apps |
| GET | `/apps/:appId` | Portal Internal | Get app details |
| PUT | `/apps/:appId` | Portal Internal | Update app |
| DELETE | `/apps/:appId` | Portal Internal | Deactivate app |
| POST | `/apps/:appId/keys` | Portal Internal | Create API key |
| DELETE | `/apps/:appId/keys/:keyId` | Portal Internal | Revoke key |

#### `health.ts` — Health Route
| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Returns `{ status: "ok", version, timestamp }` |

#### `well-known.ts` — JWKS Route
| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/jwks.json` | Returns public JWK set |

### 6.6 Middleware

#### `app-auth.ts` — App Authentication
- Extracts `X-App-Id` and `X-App-Key` headers
- Calls `validateAppApiKey()` to verify against argon2 hash
- Attaches `request.appId` and `request.appInfo` to Fastify request

#### `rate-limit.ts` — Rate Limit Middleware
Three pre-built middlewares:
- `rateLimitChallenge` — for challenge endpoint
- `rateLimitIdentityToken` — for token exchange endpoint
- `rateLimitVerifyIdentity` — for verification endpoint

Each extracts agent/app/IP identifiers and applies appropriate limits.
Returns 429 with `Retry-After` and `X-RateLimit-*` headers on limit exceeded.

### 6.7 Plugins

#### `error-handler.ts`
- Catches `AppError` instances (custom errors with HTTP codes)
- Catches Zod validation errors → 400
- Returns standardized JSON error responses
- Never leaks internal details in production

#### `request-id.ts`
- Adds `X-Request-Id` header to all responses
- Uses UUID from Fastify's built-in request ID generation

---

## 7. Portal Application (passport-portal)

### 7.1 Overview

A **Next.js 14 App Router** application with:
- Tailwind CSS for styling
- iron-session for cookie-based session management
- Server Actions for form handling
- API routes that proxy to passport-api

### 7.2 Auth System

**Session (`src/lib/session.ts`):**
- Uses `iron-session` with `SESSION_SECRET` env var
- Cookie name: `agent_passport_session`
- Session stores: `userId`, `email`, `displayName`
- Secure cookies in production

**Server Actions (`src/lib/actions.ts`):**
- `loginAction(formData)` — Calls API `/v1/auth/login`, sets session
- `registerAction(formData)` — Calls API `/v1/auth/register`, sets session
- `logoutAction()` — Destroys session, redirects to `/login`

### 7.3 Pages

#### Public Pages
| Page | Path | Description |
|------|------|-------------|
| Landing | `/` | Marketing landing page with features |
| Login | `/login` | Email/password login form |
| Register | `/register` | Email/password registration form |

#### Dashboard Pages (authenticated)
| Page | Path | Description |
|------|------|-------------|
| Overview | `/dashboard` | Stats + quick actions |
| Apps List | `/dashboard/apps` | List all user's apps |
| New App | `/dashboard/apps/new` | Create new app form |
| App Detail | `/dashboard/apps/[id]` | App info + key management |
| Settings | `/dashboard/settings` | Profile + password change |

### 7.4 API Routes

The portal has internal API routes that proxy to the passport-api:

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/apps` | GET, POST | List/create apps |
| `/api/apps/[id]` | GET, PUT, DELETE | CRUD single app |
| `/api/apps/[id]/keys` | POST | Generate new API key |
| `/api/apps/[id]/keys/[keyId]` | DELETE | Revoke a key |
| `/api/user/profile` | GET, PUT | User profile |
| `/api/user/password` | PUT | Change password |

All API routes:
1. Check iron-session for authentication
2. Forward request to passport-api with `PORTAL_INTERNAL_API_KEY`
3. Return response to the browser

### 7.5 Components

| Component | File | Description |
|-----------|------|-------------|
| `LoginForm` / `RegisterForm` | `auth-forms.tsx` | Form components with validation |
| `Sidebar` | `sidebar.tsx` | Dashboard navigation with links |
| `Button`, `Card`, `Input`, `Badge` | `ui.tsx` | Reusable Tailwind-styled primitives |

### 7.6 Dashboard Layout

The dashboard uses a sidebar layout:
```
┌─────────┬──────────────────────────────┐
│         │                              │
│ Sidebar │     Page Content             │
│         │                              │
│ 🏠 Home │                              │
│ 📱 Apps  │                              │
│ ⚙️ Settings│                             │
│         │                              │
│ [Logout]│                              │
└─────────┴──────────────────────────────┘
```

---

## 8. Shared Package

### `packages/shared`

**Exported from `src/index.ts`:**

#### Constants (`src/constants/index.ts`)
```typescript
export const JWT_ISSUER = 'agent-passport';

export enum AuditEventType {
  AGENT_REGISTERED = 'AGENT_REGISTERED',
  CHALLENGE_ISSUED = 'CHALLENGE_ISSUED',
  TOKEN_ISSUED = 'TOKEN_ISSUED',
  TOKEN_ISSUE_FAILED = 'TOKEN_ISSUE_FAILED',
  KEY_ADDED = 'KEY_ADDED',
  KEY_REVOKED = 'KEY_REVOKED',
  VERIFICATION_SUCCESS = 'VERIFICATION_SUCCESS',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  // ... more event types
}
```

#### Schemas (`src/schemas/index.ts`)
Zod validation schemas for:
- `RegisterAgentSchema` — validates handle + publicKeyB64
- `IssueChallengeSchema` — validates agentId
- `IssueTokenSchema` — validates agentId + challengeId + signatureB64
- `VerifyTokenSchema` — validates token string
- Various response types

#### Client (`src/client/index.ts`)
`PassportClient` class — a typed HTTP client for the API:
```typescript
const client = new PassportClient({
  baseUrl: 'https://passport-api.onrender.com',
  appKey: 'ap_live_...',
});
const result = await client.verifyIdentity({ token });
```

---

## 9. Authentication Flows

### 9.1 Agent Authentication Flow

```
Agent                          Passport API                    Database
  │                                │                              │
  │  POST /v1/agents/register      │                              │
  │  { handle, publicKeyB64 }      │                              │
  │──────────────────────────────▶ │  Validate public key          │
  │                                │  Check handle uniqueness      │
  │                                │──────────────────────────────▶│
  │                                │  INSERT Agent + AgentKey      │
  │◀────────────────────────────── │                              │
  │  { agentId }                   │                              │
  │                                │                              │
  │  POST /v1/agents/{id}/challenge│                              │
  │──────────────────────────────▶ │  Generate random nonce        │
  │                                │──────────────────────────────▶│
  │                                │  INSERT Challenge             │
  │◀────────────────────────────── │  Store in Redis (cache)       │
  │  { challengeId, nonce, expiry }│                              │
  │                                │                              │
  │  (Agent signs nonce locally)   │                              │
  │                                │                              │
  │  POST /v1/agents/{id}/identity-token                          │
  │  { challengeId, signatureB64 } │                              │
  │──────────────────────────────▶ │  Fetch challenge from DB      │
  │                                │  Check: not used, not expired │
  │                                │  Fetch agent's active keys    │
  │                                │  ed25519.verify(sig, nonce, key)
  │                                │  Mark challenge as used       │
  │                                │  Create JWT (EdDSA signed)    │
  │◀────────────────────────────── │  Log audit event              │
  │  { token, expiresAt }         │                              │
```

### 9.2 Token Verification Flow

```
Agent              App                   Passport API            Database/Redis
  │                 │                         │                       │
  │  Present token  │                         │                       │
  │────────────────▶│                         │                       │
  │                 │  POST /v1/tokens/verify  │                       │
  │                 │  Headers: X-App-Id,      │                       │
  │                 │           X-App-Key      │                       │
  │                 │  Body: { token }         │                       │
  │                 │────────────────────────▶ │  Validate app key     │
  │                 │                         │  (argon2 verify)      │
  │                 │                         │  Verify JWT signature  │
  │                 │                         │  Check agent in DB     │
  │                 │                         │  Compute risk score    │
  │                 │                         │  Record activity       │
  │                 │                         │  Log verification event│
  │                 │◀─────────────────────── │                       │
  │                 │  { valid, agentId,       │                       │
  │                 │    handle, risk: {       │                       │
  │                 │      score, action,      │                       │
  │                 │      reasons } }         │                       │
  │                 │                         │                       │
  │  Accept/Reject  │                         │                       │
  │◀────────────────│                         │                       │
```

### 9.3 Portal Auth Flow

```
Browser                     Portal (Next.js)              Passport API
  │                              │                              │
  │  POST /login                 │                              │
  │  { email, password }         │                              │
  │─────────────────────────────▶│                              │
  │                              │  POST /v1/auth/login         │
  │                              │─────────────────────────────▶│
  │                              │                              │ argon2.verify()
  │                              │◀─────────────────────────────│
  │                              │  { id, email }               │
  │                              │                              │
  │                              │  Set iron-session cookie     │
  │◀─────────────────────────────│                              │
  │  Set-Cookie: agent_passport_session=...                     │
  │  Redirect to /dashboard      │                              │
```

---

## 10. Security Implementation

### 10.1 Cryptographic Algorithms

| Purpose | Algorithm | Library |
|---------|-----------|---------|
| Agent identity | Ed25519 | `@noble/ed25519` |
| JWT signing | EdDSA (Ed25519) | `jose` |
| Password hashing | Argon2id | `argon2` |
| API key hashing | Argon2id | `argon2` |
| Random generation | CSPRNG | `crypto.getRandomValues` |

### 10.2 Key Security Properties

- **Private keys never transmitted**: Agents sign locally; only signatures are sent
- **Challenge single-use**: Once used, challenges are marked in DB and rejected
- **Challenge expiry**: 5-minute TTL to prevent aged nonce attacks
- **Token short-lived**: Default 60-minute TTL (configurable)
- **Key hashing**: App keys stored as argon2id hashes (memoryCost=64KB, timeCost=3)
- **Password hashing**: Portal passwords stored as argon2id hashes
- **Audit everything**: Every security-relevant action logged to `audit_events`

### 10.3 Error Handling

Custom `AppError` class with standardized error codes:
```typescript
enum ErrorCode {
  INVALID_PUBLIC_KEY, HANDLE_TAKEN, AGENT_NOT_FOUND,
  AGENT_SUSPENDED, CHALLENGE_NOT_FOUND, CHALLENGE_EXPIRED,
  CHALLENGE_ALREADY_USED, INVALID_SIGNATURE, NO_ACTIVE_KEYS,
  KEY_NOT_FOUND, KEY_ALREADY_REVOKED, UNAUTHORIZED,
  RATE_LIMITED, INTERNAL_ERROR
}
```

---

## 11. Rate Limiting & Risk Engine

### 11.1 Rate Limiting

**Algorithm**: Sliding window using Redis sorted sets
- Members are timestamped entries
- Window slides as time progresses
- Expired entries auto-cleaned

**Response on limit exceeded** (HTTP 429):
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1738411260
Retry-After: 45
```

### 11.2 Risk Engine

**Input signals:**
1. Agent status (from DB)
2. Agent age (from DB `createdAt`)
3. Invalid attempt rate (from Redis counters)
4. Rate limit hits (from Redis counters)
5. Activity burst (from Redis counters)

**Output:**
```typescript
interface RiskAssessment {
  score: number;        // 0-100
  recommendedAction: 'allow' | 'throttle' | 'block';
  reasons: string[];    // Human-readable explanations
}
```

**Graceful degradation**: All Redis operations in the risk engine check `isRedisAvailable()` first and skip silently with logging if Redis is down.

---

## 12. Scripts & CLI Tools

All scripts in `apps/passport-api/scripts/`:

### `gen-agent-keypair.ts`
Generates an Ed25519 keypair for testing:
```bash
npx tsx scripts/gen-agent-keypair.ts
# Output: publicKeyB64 + privateKeyB64
```

### `gen-jwk.ts`
Generates a JWT signing key (JWK format):
```bash
npx tsx scripts/gen-jwk.ts
# Output: JWT_SIGNING_JWK_JSON={"kty":"OKP","crv":"Ed25519",...}
```

### `sign-challenge.ts`
Signs a nonce with a private key (for testing):
```bash
NONCE=abc123 PRIVATE_KEY_B64=... npx tsx scripts/sign-challenge.ts
# Output: signatureB64
```

### `bootstrap-admin.ts`
Creates the first portal admin user:
```bash
DATABASE_URL=... ADMIN_EMAIL=admin@test.com ADMIN_PASSWORD=... npx tsx scripts/bootstrap-admin.ts
```
Used by GitHub Actions `bootstrap-admin.yml` workflow.

---

## 13. Tests

### Test Setup (`tests/setup.ts`)
- Generates a test Ed25519 JWK at test startup
- Sets `NODE_ENV=test` and required env vars
- No real database or Redis needed (mocked via architecture)

### Test Suites (33 tests total)

| Suite | File | Tests | What's Tested |
|-------|------|-------|---------------|
| **Health** | `health.test.ts` | 1 | Health endpoint returns `ok` |
| **Crypto** | `crypto.test.ts` | 11 | Ed25519 sign/verify, key validation, nonce generation |
| **JWT** | `jwt.test.ts` | 9 | Token creation, verification, claims, expiry, JWKS |
| **Token** | `token.test.ts` | 7 | Full verify pipeline, suspended agents, invalid tokens |
| **Risk Engine** | `risk-engine.test.ts` | 5 | Risk scoring rules, score→action mapping |

### Running Tests
```bash
cd apps/passport-api
npm test        # or: pnpm test / vitest run
```

### Known Test Warnings
The `token.test.ts` produces stderr warnings about `persistRiskState` failing because Prisma is undefined in unit tests. Tests still pass because risk persistence failures are caught and logged (not thrown).

---

## 14. CI/CD & GitHub Actions

### `ci.yml` — Continuous Integration
- **Triggers**: Push to `main`, pull requests to `main`
- **Job 1**: Lint + Typecheck + Build (all packages)
- **Job 2**: Run tests (depends on Job 1)
- **Node 20**, **pnpm 9**

### `migrate.yml` — Database Migration
- **Trigger**: Manual (`workflow_dispatch`)
- **Safety**: Requires typing "migrate" to confirm
- **Action**: Runs `prisma migrate deploy`
- **Secret**: `DATABASE_URL`

### `bootstrap-admin.yml` — Admin User Creation
- **Trigger**: Manual with inputs (email, password)
- **Action**: Runs `bootstrap-admin.ts` script
- **Security**: Password is hashed with argon2id, never logged
- **Secret**: `DATABASE_URL`

---

## 15. Configuration & Environment Variables

### passport-api `.env.example`
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@host/db
REDIS_URL=redis://localhost:6379
JWT_SIGNING_JWK_JSON={"kty":"OKP","crv":"Ed25519","x":"...","d":"..."}
TOKEN_TTL_MINUTES=60
CHALLENGE_TTL_MINUTES=5
CORS_ALLOWED_ORIGINS=http://localhost:3000
PORTAL_INTERNAL_API_KEY=a-random-32-char-minimum-string-here
```

### passport-portal `.env.example`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
SESSION_SECRET=a-random-32-char-minimum-string-for-sessions
DATABASE_URL=postgresql://user:pass@host/db
```

---

## 16. API Endpoints Reference

### Public Endpoints (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/healthz` | Health check |
| GET | `/.well-known/jwks.json` | Public key set |
| POST | `/v1/agents/register` | Register agent |
| GET | `/v1/agents/:agentId` | Get agent info |
| POST | `/v1/agents/:agentId/challenge` | Request challenge |
| POST | `/v1/agents/:agentId/identity-token` | Exchange signature for JWT |

### App-Authenticated Endpoints (X-App-Id + X-App-Key)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/tokens/verify` | Verify identity token |
| POST | `/v1/tokens/introspect` | Token introspection (RFC 7662) |

### Portal Endpoints (Portal Internal API Key)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/auth/login` | Portal login |
| POST | `/v1/auth/register` | Portal registration |
| GET | `/v1/admin/me` | Get current user |
| PUT | `/v1/admin/me` | Update profile |
| PUT | `/v1/admin/me/password` | Change password |
| POST | `/v1/admin/apps` | Create app |
| GET | `/v1/admin/apps` | List apps |
| GET | `/v1/admin/apps/:appId` | Get app details |
| PUT | `/v1/admin/apps/:appId` | Update app |
| DELETE | `/v1/admin/apps/:appId` | Deactivate app |
| POST | `/v1/admin/apps/:appId/keys` | Create API key |
| DELETE | `/v1/admin/apps/:appId/keys/:keyId` | Revoke key |

---

## 17. Deployment Architecture

```
                    ┌──────────────────────────────────────┐
                    │              GitHub                    │
                    │  ┌────────────┐  ┌────────────────┐  │
                    │  │ ci.yml     │  │ migrate.yml    │  │
                    │  │ (auto)     │  │ (manual)       │  │
                    │  └────────────┘  └────────┬───────┘  │
                    │  ┌────────────┐           │          │
                    │  │ bootstrap  │           │          │
                    │  │ -admin.yml │           │          │
                    │  └────────────┘           │          │
                    └──────────────────────────┼──────────┘
                                               │
                    ┌──────────────────────────┼──────────┐
                    │         Neon (PostgreSQL) │          │
                    │                          ▼          │
                    │  ┌──────────────────────────────┐   │
                    │  │  agents, apps, keys, events  │   │
                    │  │  portal_users, challenges    │   │
                    │  │  risk_state, audit_events    │   │
                    │  └──────────────────────────────┘   │
                    └──────────────┬───────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               │                   │                   │
     ┌─────────▼─────────┐        │        ┌──────────▼──────────┐
     │     Render         │        │        │      Vercel          │
     │  passport-api      │        │        │  passport-portal     │
     │  (Fastify)         │        │        │  (Next.js)           │
     │                    │        │        │                      │
     │  Env vars:         │        │        │  Env vars:           │
     │  - DATABASE_URL    │◀───────┘        │  - NEXT_PUBLIC_API   │
     │  - REDIS_URL       │────┐            │  - SESSION_SECRET    │
     │  - JWT_SIGNING_JWK │    │            │  - DATABASE_URL      │
     └────────────────────┘    │            └──────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Upstash (Redis)  │
                    │                      │
                    │  - Rate limit data   │
                    │  - Risk counters     │
                    │  - Challenge cache   │
                    │  - Distributed locks │
                    └──────────────────────┘
```

### Cost: $0/month on free tiers

| Service | Free Tier Limits |
|---------|-----------------|
| Neon | 0.5 GB storage, 190 compute hrs/month |
| Upstash | 10K commands/day, 256 MB |
| Render | 750 hrs/month (sleeps after 15 min inactivity) |
| Vercel | 100 GB bandwidth, serverless functions |

---

## 18. Documentation Files

| File | Lines | Content |
|------|-------|---------|
| `docs/openapi.yaml` | ~480 | Full OpenAPI 3.1 specification |
| `docs/INTEGRATION.md` | ~250 | Code examples for agents and apps |
| `docs/SMOKE_TEST.md` | ~300 | Step-by-step curl commands for E2E testing |
| `docs/SECURITY.md` | ~350 | Threat model, key rotation, attack mitigations |
| `docs/TOPICS.md` | ~120 | GitHub topics, SEO keywords, social tags |
| `docs/LAUNCH_KIT.md` | ~400 | 5 X posts, 5 Moltbook posts, 4 agent prompts, 7-day plan |
| `docs/DEPLOY_STARTUP_STACK.md` | ~300 | Full deployment guide (Neon→Upstash→Render→Vercel) |
| `docs/SECRETS.md` | ~50 | How secrets are managed |
| `README.md` | ~250 | SEO-optimized README with architecture diagram |
| `SECURITY.md` | ~70 | Security policy (root level) |

---

## 19. Known Limitations & Technical Debt

### Current Limitations

1. **No email verification** — Portal users aren't verified via email
2. **No RBAC granularity** — Only `admin` and `viewer` roles; viewer role not enforced
3. **No token revocation** — JWTs can't be individually revoked before expiry
4. **No webhook support** — Apps can't receive push notifications for events
5. **No SDK packages** — Agents/apps must use raw HTTP; typed SDK is in shared but not published
6. **Render free tier sleeps** — API goes to sleep after 15 min inactivity (cold start ~30s)
7. **No OpenID Connect discovery** — `/.well-known/openid-configuration` not implemented
8. **Single signing key** — No key rotation mechanism (must redeploy with new JWK)

### Test Coverage Gaps

- No integration tests (routes tested indirectly via services)
- No portal tests (only one landing page test)
- No load/performance tests
- Rate limiter tests require real Redis

### Technical Debt

- `persistRiskState` throws in tests (Prisma undefined) — caught but logs warnings
- Token TTL is 60 min everywhere (config + all docs — inconsistency resolved)
- API routes use `/v1/` prefix but docs/README show non-prefixed paths
- Portal API routes bypass the internal key check in some code paths   
- The `LICENSE` file exists but wasn't shown during analysis

---

*End of document. This covers every file, every function, every endpoint, and every flow in the Agent Passport codebase as of v0.1.0.*
