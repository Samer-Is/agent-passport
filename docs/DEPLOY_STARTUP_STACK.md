# Deploy Agent Passport (Startup Stack)

> Deploy the complete Agent Passport stack in ~15 minutes using free-tier services. No local runtime required.

## Stack Overview

| Component | Service | Tier | Purpose |
|-----------|---------|------|---------|
| Database | [Neon](https://neon.tech) | Free | PostgreSQL for agents, apps, audit logs |
| Cache | [Upstash](https://upstash.com) | Free | Redis for rate limiting & risk signals |
| API | [Render](https://render.com) | Free | passport-api (Fastify) |
| Portal | [Vercel](https://vercel.com) | Free | passport-portal (Next.js) |

```
┌─────────────────────────────────────────────────────────────────┐
│                    Deployment Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Internet                                                       │
│      │                                                           │
│      ├──────────────────┬────────────────────┐                  │
│      │                  │                    │                  │
│      ▼                  ▼                    ▼                  │
│  ┌────────┐      ┌────────────┐      ┌────────────┐            │
│  │ Render │      │  Vercel    │      │  GitHub    │            │
│  │  API   │      │  Portal    │      │  Actions   │            │
│  └───┬────┘      └─────┬──────┘      └──────┬─────┘            │
│      │                 │                    │                   │
│      │                 │                    │ (migrations)      │
│      ▼                 │                    ▼                   │
│  ┌────────────────────┐│            ┌────────────┐             │
│  │      Neon          ││            │            │             │
│  │   (PostgreSQL)     │◀───────────▶│  Upstash   │             │
│  └────────────────────┘             │  (Redis)   │             │
│                                     └────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- GitHub account (for repository and Actions)
- Email for service signups
- No credit card required for free tiers

## Step 1: Create Neon Database

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up / Sign in
3. Click **"New Project"**
4. Configure:
   - **Name**: `agent-passport`
   - **Region**: Choose closest to your users
   - **Postgres Version**: 16 (latest)
5. Click **"Create Project"**
6. Copy the **Connection String** (pooled):
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

**Save this as `DATABASE_URL`**

## Step 2: Create Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Sign up / Sign in
3. Click **"Create Database"**
4. Configure:
   - **Name**: `agent-passport-redis`
   - **Type**: Regional
   - **Region**: Same as Neon (or closest)
   - **TLS**: Enabled ✓
5. Click **"Create"**
6. Go to **REST API** section
7. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

**Save both values**

## Step 3: Generate JWT Signing Key

Run locally or in any Node.js environment:

```bash
node -e "
const { generateKeyPairSync } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');

const jwk = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: publicKey.export({ format: 'jwk' }).x,
  d: privateKey.export({ format: 'jwk' }).d,
  kid: 'passport-ed25519-001',
  use: 'sig',
  alg: 'EdDSA'
};

console.log('JWT_SIGNING_JWK_JSON=' + JSON.stringify(jwk));
"
```

**Save the entire JSON output as `JWT_SIGNING_JWK_JSON`**

## Step 4: Deploy API to Render

### Option A: One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Option B: Manual Setup

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `passport-api`
   - **Region**: Same as Neon
   - **Branch**: `main`
   - **Root Directory**: `apps/passport-api`
   - **Runtime**: Node
   - **Build Command**: `pnpm install && pnpm build`
   - **Start Command**: `pnpm start`
5. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | (from Neon) |
| `UPSTASH_REDIS_REST_URL` | (from Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | (from Upstash) |
| `JWT_SIGNING_JWK_JSON` | (from Step 3) |
| `CORS_ORIGINS` | `https://your-portal.vercel.app` |

6. Click **"Create Web Service"**

### Run Migrations

After deploy, run migrations via GitHub Actions (see Step 6) or manually:

```bash
# From apps/passport-api directory
DATABASE_URL="your-neon-url" npx prisma migrate deploy
```

## Step 5: Deploy Portal to Vercel

### Option A: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zerobase-labs/agent-passport&root-directory=apps/passport-portal)

### Option B: Manual Setup

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/passport-portal`
4. Add **Environment Variables**:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://passport-api.onrender.com` |
| `SESSION_SECRET` | (generate random 32+ char string) |
| `DATABASE_URL` | (same Neon URL) |

5. Click **"Deploy"**

### Generate Session Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 6: Configure GitHub Actions

### Add Repository Secrets

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Value |
|--------|-------|
| `DATABASE_URL` | Neon connection string |
| `UPSTASH_REDIS_REST_URL` | Upstash URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash token |
| `JWT_SIGNING_JWK_JSON` | JWT signing key JSON |

### Run Database Migration

1. Go to **Actions** tab
2. Select **"Database Migration"** workflow
3. Click **"Run workflow"**
4. Confirm and run

### Bootstrap Admin User

1. Go to **Actions** tab
2. Select **"Bootstrap Admin"** workflow
3. Click **"Run workflow"**
4. Enter:
   - **Email**: Your admin email
   - **Password**: Strong password (16+ chars)
5. Run workflow

**⚠️ Save the password - it's not logged or stored anywhere!**

## Step 7: Verify Deployment

### Health Check

```bash
curl https://passport-api.onrender.com/healthz
```

Expected:
```json
{"status":"ok","version":"0.1.0","timestamp":"..."}
```

### JWKS Endpoint

```bash
curl https://passport-api.onrender.com/.well-known/jwks.json
```

Should return your public key.

### Portal Access

1. Visit `https://your-portal.vercel.app`
2. Sign in with your admin credentials
3. Create an app
4. Generate an API key

### Full Smoke Test

See [docs/SMOKE_TEST.md](./SMOKE_TEST.md) for complete end-to-end verification.

## Environment Variables Reference

### passport-api (Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3000` |
| `DATABASE_URL` | Yes | Neon PostgreSQL URL |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `JWT_SIGNING_JWK_JSON` | Yes | Ed25519 JWK for signing |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `LOG_LEVEL` | No | `info` (default), `debug`, `error` |

### passport-portal (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Render API URL |
| `DATABASE_URL` | Yes | Same Neon URL |
| `SESSION_SECRET` | Yes | Random 32+ char string |
| `NODE_ENV` | No | `production` (auto-set) |

## Troubleshooting

### API won't start

1. Check Render logs
2. Verify all environment variables are set
3. Ensure DATABASE_URL has `?sslmode=require`

### Database connection errors

1. Check Neon is not paused (free tier pauses after inactivity)
2. Verify connection string includes SSL
3. Check IP allowlist if configured

### Redis connection errors

1. Verify Upstash credentials
2. Check TLS is enabled
3. Test with Upstash CLI in console

### Portal can't reach API

1. Check CORS_ORIGINS includes portal URL
2. Verify NEXT_PUBLIC_API_URL is correct
3. Check for mixed content (https/http mismatch)

### Migrations fail

1. Run manually with verbose logging
2. Check DATABASE_URL in GitHub Secrets
3. Ensure Neon project isn't paused

## Cost Estimation

All services have generous free tiers:

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Neon | Free | 0.5 GB storage, 190 compute hours/month |
| Upstash | Free | 10K commands/day, 256 MB |
| Render | Free | 750 hours/month, sleeps after 15 min inactivity |
| Vercel | Hobby | 100 GB bandwidth, serverless functions |

**Total cost for MVP: $0/month** 🎉

## Scaling Up

When ready to scale:

### Neon
- Upgrade to Pro ($19/month) for always-on, autoscaling

### Upstash
- Pay-as-you-go pricing kicks in after free tier

### Render
- Upgrade to Starter ($7/month) for always-on, more resources

### Vercel
- Pro plan ($20/month) for team features, more bandwidth

## Next Steps

1. ✅ Run [Smoke Test](./SMOKE_TEST.md)
2. 📖 Read [Integration Guide](./INTEGRATION.md)
3. 🔒 Review [Security Documentation](./SECURITY.md)
4. 🚀 Check [Launch Kit](./LAUNCH_KIT.md) for social posts

## Support

- GitHub Issues: [zerobase-labs/agent-passport/issues](https://github.com/zerobase-labs/agent-passport/issues)
- Documentation: [docs/](https://github.com/zerobase-labs/agent-passport/tree/main/docs)
