import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  
  // JWT
  JWT_SIGNING_JWK_JSON: z.string().min(1),
  TOKEN_TTL_MINUTES: z.coerce.number().default(60),
  
  // CORS
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  
  // Portal internal key (for portal -> API communication)
  PORTAL_INTERNAL_API_KEY: z.string().min(32).optional(),
  
  // Challenge settings
  CHALLENGE_TTL_MINUTES: z.coerce.number().default(5),
});

// Test schema - relaxed for unit testing
const testEnvSchema = z.object({
  NODE_ENV: z.literal('test'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default('postgresql://test:test@localhost:5432/test'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SIGNING_JWK_JSON: z.string().min(1),
  TOKEN_TTL_MINUTES: z.coerce.number().default(60),
  CORS_ALLOWED_ORIGINS: z.string().default('*'),
  PORTAL_INTERNAL_API_KEY: z.string().optional(),
  CHALLENGE_TTL_MINUTES: z.coerce.number().default(5),
});

function parseEnv() {
  const isTest = process.env.NODE_ENV === 'test';
  const schema = isTest ? testEnvSchema : envSchema;
  const result = schema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    
    // In development, provide helpful defaults message
    if (process.env.NODE_ENV !== 'production') {
      console.error('\nMake sure to set all required environment variables.');
      console.error('See .env.example for reference.\n');
    }
    
    // In test mode, throw instead of exiting
    if (isTest) {
      throw new Error('Invalid environment variables for test');
    }
    
    process.exit(1);
  }
  
  return result.data;
}

const env = parseEnv();

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  jwtSigningJwk: env.JWT_SIGNING_JWK_JSON,
  tokenTtlMinutes: env.TOKEN_TTL_MINUTES,
  corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS === '*' 
    ? true 
    : env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()),
  portalInternalApiKey: env.PORTAL_INTERNAL_API_KEY,
  challengeTtlMinutes: env.CHALLENGE_TTL_MINUTES,
  
  // Computed
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
} as const;

export type Config = typeof config;
