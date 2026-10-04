-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "salonId" TEXT,
ALTER COLUMN "tournamentId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Match_salonId_finishedAt_idx" ON "Match"("salonId", "finishedAt");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
