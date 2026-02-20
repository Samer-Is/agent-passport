// Test setup - runs before all tests
// Set all required environment variables for testing

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SIGNING_JWK_JSON = JSON.stringify({
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'mKr5GTrhhVdBpXbfsG7RMDMbwZpW4FwqsR7K8fKrT4A',
  d: 'kqpOa2rmMwLxL9GQwKpHl0SDYX9lYb0_jLVqaWmA8Tk',
});
process.env.TOKEN_TTL_MINUTES = '60';
process.env.CHALLENGE_TTL_MINUTES = '5';
process.env.CORS_ALLOWED_ORIGINS = '*';
