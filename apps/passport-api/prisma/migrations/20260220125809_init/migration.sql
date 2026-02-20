-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "AppKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('agent', 'app', 'portal_user', 'system', 'ip');

-- CreateEnum
CREATE TYPE "RiskAction" AS ENUM ('allow', 'throttle', 'block');

-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('admin', 'viewer');

-- CreateEnum
CREATE TYPE "PortalUserStatus" AS ENUM ('active', 'suspended');

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_keys" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "public_key_b64" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "agent_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "allowed_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_callback_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AppStatus" NOT NULL DEFAULT 'active',
    "portal_user_id" UUID NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_keys" (
    "id" UUID NOT NULL,
    "app_id" UUID NOT NULL,
    "name" TEXT,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "AppKeyStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,
    "last_used_at" TIMESTAMPTZ,

    CONSTRAINT "app_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "ip" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_events" (
    "id" UUID NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_id" UUID NOT NULL,
    "agent_id" UUID,
    "result" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "ip" TEXT,

    CONSTRAINT "verification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_state" (
    "agent_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "score" SMALLINT NOT NULL,
    "recommended_action" "RiskAction" NOT NULL,
    "reasons" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "risk_state_pkey" PRIMARY KEY ("agent_id")
);

-- CreateTable
CREATE TABLE "portal_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "PortalRole" NOT NULL DEFAULT 'viewer',
    "status" "PortalUserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_handle_key" ON "agents"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_email_key" ON "portal_users"("email");

-- AddForeignKey
ALTER TABLE "agent_keys" ADD CONSTRAINT "agent_keys_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_keys" ADD CONSTRAINT "app_keys_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_state" ADD CONSTRAINT "risk_state_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
