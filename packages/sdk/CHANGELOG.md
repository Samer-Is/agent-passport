# Changelog

## 0.1.0 (2026-02-20)

### Added
- `AgentPassportClient` for apps to verify and introspect agent identity tokens
- `AgentClient` for agents to register and authenticate via challenge-response
- Typed error classes: `PassportError`, `PassportAuthError`, `PassportRateLimitError`, `PassportNetworkError`, `PassportValidationError`
- Automatic retry with exponential backoff on 429 responses
- Configurable timeout and max retries
- Full TypeScript types exported
- ESM + CJS dual output via tsup
- `revoke()` method for token revocation
