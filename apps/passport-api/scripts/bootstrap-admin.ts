/**
 * Bootstrap the first admin user for the portal
 * 
 * This script is designed to run in GitHub Actions via workflow_dispatch.
 * It creates the first admin user in the portal_users table.
 * 
 * Required environment variables:
 * - DATABASE_URL: Postgres connection string
 * - ADMIN_EMAIL: Email for the admin user
 * - ADMIN_PASSWORD: Password (will be hashed with argon2id)
 * 
 * Usage (local): 
 *   DATABASE_URL="..." ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="..." pnpm tsx scripts/bootstrap-admin.ts
 * 
 * Usage (GitHub Actions):
 *   See .github/workflows/bootstrap-admin.yml
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  
  if (!email || !password) {
    console.error('❌ Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD');
    process.exit(1);
  }
  
  if (password.length < 12) {
    console.error('❌ Password must be at least 12 characters');
    process.exit(1);
  }
  
  const prisma = new PrismaClient();
  
  try {
    // Check if user already exists
    const existing = await prisma.portalUser.findUnique({
      where: { email },
    });
    
    if (existing) {
      console.log(`⚠️  Admin user with email ${email} already exists`);
      process.exit(0);
    }
    
    // Hash password with argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 4,
    });
    
    // Create admin user
    const user = await prisma.portalUser.create({
      data: {
        email,
        passwordHash,
        role: 'admin',
      },
    });
    
    console.log(`✅ Admin user created successfully`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    
    // Security: Never log the password
    console.log('\n⚠️  Password was hashed with argon2id and stored securely.');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
