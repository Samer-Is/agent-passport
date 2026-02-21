# Changelog

## 0.1.1 (2026-02-22)

### Added
- `HumanVerificationInfo` type for individual human verification records
- `HumanVerificationSummary` type for human verification status summary
- `humanVerification` optional field on `VerifyResult` — includes verified boolean and verifications array
- Supported human verification providers: github, mercle, google, email, phone, worldcoin, civic

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
