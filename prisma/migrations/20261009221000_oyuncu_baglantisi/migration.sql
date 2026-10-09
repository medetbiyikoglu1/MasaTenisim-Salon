-- AlterTable
ALTER TABLE "SalonPlayer" ADD COLUMN     "accessTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SalonPlayer_accessTokenHash_key" ON "SalonPlayer"("accessTokenHash");

