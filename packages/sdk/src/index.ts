// ============================================================================
// Agent Passport SDK — Main entry point
// ============================================================================

// Clients
export { AgentPassportClient } from './client.js';
export { AgentClient } from './agent.js';

// Error classes
export {
  PassportError,
  PassportNetworkError,
  PassportAuthError,
  PassportRateLimitError,
  PassportValidationError,
} from './errors.js';

// Types
export type {
  AgentPassportClientOptions,
  AgentClientOptions,
  VerifyResult,
  IntrospectResult,
  RevokeResult,
  RiskAction,
  RiskAssessment,
  HumanVerificationInfo,
  HumanVerificationSummary,
  RegisterAgentParams,
  RegisterAgentResult,
  ChallengeResult,
  AuthenticateParams,
  AuthenticateResult,
  ExchangeTokenParams,
} from './types.js';
