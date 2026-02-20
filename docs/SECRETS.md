# Secrets and Environment Variables

This document lists all secrets required for deploying Agent Passport.

## GitHub Repository Secrets

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

| Secret Name | Description | Where to get it |
|------------|-------------|-----------------|
| `DATABASE_URL` | Neon Postgres connection string | Neon dashboard > Connection Details |
| `REDIS_URL` | Upstash Redis URL (TLS) | Upstash dashboard > Redis > Details |

## Render Environment Variables

Set these in your Render Web Service:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Defaults to `3001`, Render sets this automatically |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `REDIS_URL` | Yes | Upstash Redis URL |
| `JWT_SIGNING_JWK_JSON` | Yes | JWK for signing tokens (generate with script) |
| `TOKEN_TTL_MINUTES` | No | Token TTL, defaults to `60` |
| `CHALLENGE_TTL_MINUTES` | No | Challenge TTL, defaults to `5` |
| `CORS_ALLOWED_ORIGINS` | Yes | Comma-separated list of allowed origins |
| `PORTAL_INTERNAL_API_KEY` | Yes | Secure random string (32+ chars) |

## Vercel Environment Variables

Set these in your Vercel project settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PASSPORT_API_BASE_URL` | Yes | Your Render API URL |
| `PORTAL_AUTH_SECRET` | Yes | Session encryption secret (32+ chars) |
| `PORTAL_INTERNAL_API_KEY` | No | Same as Render's, for server-to-server calls |

## Generating Secrets

### JWT Signing Key

```bash
# From the repo root
pnpm -C apps/passport-api tsx scripts/gen-jwk.ts
```

This outputs a JWK JSON string. Copy the entire JSON as `JWT_SIGNING_JWK_JSON`.

### Random Secrets

For `PORTAL_AUTH_SECRET` and `PORTAL_INTERNAL_API_KEY`:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or using OpenSSL
openssl rand -base64 32
```

## Security Notes

- Never commit secrets to the repository
- Use different secrets for development and production
- Rotate `JWT_SIGNING_JWK_JSON` periodically (existing tokens will be invalidated)
- Store secrets only in GitHub Secrets and deployment platform environment variables
