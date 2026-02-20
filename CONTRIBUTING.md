# Contributing to Agent Passport

Thank you for your interest in contributing to Agent Passport! This document explains how to set up your development environment, run tests, and submit changes.

## Development Setup

### Prerequisites

- **Node.js** >= 20
- **pnpm** >= 8 (`npm install -g pnpm`)
- **Docker** (optional, for local PostgreSQL/Redis)

### Install Dependencies

```bash
git clone https://github.com/zerobase-labs/agent-passport.git
cd agent-passport
pnpm install
```

### Environment Variables

Copy the example env file and fill in your values:

```bash
cp apps/passport-api/.env.example apps/passport-api/.env
```

For local development you need at minimum:
- `DATABASE_URL` — PostgreSQL connection string (Neon free tier or local)
- `JWT_SIGNING_JWK_JSON` — Generate with `node apps/passport-api/scripts/gen-jwk.ts`
- `ADMIN_PORTAL_PASSWORD` — Any string for local portal auth

Redis is optional — the app degrades gracefully without it (rate limiting and revocation are skipped).

### Database Setup

```bash
cd apps/passport-api
npx prisma migrate dev
```

### Running Locally

```bash
# From project root — starts all apps
pnpm dev

# Or individually:
pnpm --filter passport-api dev     # API on :3000
pnpm --filter passport-portal dev  # Portal on :3001
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter passport-api test
pnpm --filter @zerobase-labs/passport-sdk test
pnpm --filter shared test

# Run a single test file
cd apps/passport-api
npx vitest run tests/revocation.test.ts
```

All tests must pass before submitting a pull request.

## Code Style

This project uses:
- **TypeScript** with strict mode — no `any` types
- **Prettier** for formatting (config in `.prettierrc`)
- **ESLint** for linting

Format your code before committing:

```bash
pnpm format
```

## Project Structure

```
agent-passport/
├── apps/
│   ├── passport-api/          # Fastify API server
│   └── passport-portal/       # Next.js admin portal
├── packages/
│   ├── shared/                # Shared Zod schemas and types
│   └── sdk/                   # @zerobase-labs/passport-sdk npm package
├── examples/
│   └── openclaw-integration/  # Integration examples
└── docs/                      # Documentation
```

## Pull Request Guidelines

1. **Fork** the repository and create a branch from `main`
2. **Name** your branch descriptively: `feature/token-revocation`, `fix/rate-limit-bug`
3. **Write tests** for any new functionality or bug fix
4. **Update docs** if you change API behavior (OpenAPI spec, integration guide, etc.)
5. **Run the full test suite** before submitting: `pnpm test`
6. **Keep PRs focused** — one feature or fix per PR
7. **Write clear commit messages** explaining what and why

### PR Template

When opening a PR, include:
- **What** this PR does (1-2 sentences)
- **Why** this change is needed
- **How** to test the change
- **Screenshots** if the change affects the portal UI

## Adding New API Endpoints

When adding a new endpoint:

1. Add the route handler in `apps/passport-api/src/routes/`
2. Add Zod request/response schemas in `packages/shared/src/schemas/`
3. Add the endpoint to `docs/openapi.yaml`
4. Write tests in `apps/passport-api/tests/`
5. Update integration docs if it's a public-facing endpoint

## Reporting Bugs

Use the [Bug Report template](https://github.com/zerobase-labs/agent-passport/issues/new?template=bug_report.md) and include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS)

## Reporting Security Issues

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email security@agent-passport.dev or use [GitHub Security Advisories](https://github.com/zerobase-labs/agent-passport/security/advisories).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
