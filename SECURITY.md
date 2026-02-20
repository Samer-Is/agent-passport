# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. Please report them responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email: security@agentpassport.dev
3. Or use [GitHub Security Advisories](https://github.com/zerobase-labs/agent-passport/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any suggested fixes (optional)

### Response Timeline

| Severity | Response | Fix Timeline |
|----------|----------|--------------|
| Critical | 24 hours | 24-72 hours |
| High | 48 hours | 1-2 weeks |
| Medium | 7 days | 2-4 weeks |
| Low | 14 days | Next release |

## Scope

**In scope:**
- Agent Passport API (`apps/passport-api`)
- Agent Passport Portal (`apps/passport-portal`)
- Authentication and authorization flaws
- Cryptographic issues
- Data exposure vulnerabilities

**Out of scope:**
- DoS attacks against production infrastructure
- Social engineering
- Third-party dependencies (report to upstream)

## Security Features

- **Ed25519 Cryptography**: Agents authenticate using Ed25519 signatures. Private keys never leave the agent.
- **Argon2id Hashing**: All passwords and API keys are hashed using Argon2id.
- **Short-lived Tokens**: JWT identity tokens expire in 60 minutes.
- **Challenge-Response**: Nonces prevent replay attacks (5-minute TTL, single-use).
- **Rate Limiting**: Sliding window limits per agent, app, and IP address.
- **Risk Scoring**: Real-time risk assessment (0-100) with allow/throttle/block recommendations.
- **Audit Logging**: All security-relevant events are logged.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | ✅ |

## Detailed Documentation

For comprehensive security documentation including threat model, key rotation, and incident response:

📖 [docs/SECURITY.md](docs/SECURITY.md)

## Acknowledgments

We thank security researchers who report vulnerabilities responsibly. Reporters will be acknowledged here (with permission) after issues are resolved.
