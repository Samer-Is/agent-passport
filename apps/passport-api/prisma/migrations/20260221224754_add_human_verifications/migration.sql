-- CreateEnum
CREATE TYPE "HumanVerificationStatus" AS ENUM ('active', 'expired', 'revoked');

-- CreateTable
CREATE TABLE "human_verifications" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "display_name" TEXT,
    "verified_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "status" "HumanVerificationStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "human_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "human_verifications_agent_id_provider_key" ON "human_verifications"("agent_id", "provider");

-- AddForeignKey
ALTER TABLE "human_verifications" ADD CONSTRAINT "human_verifications_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
