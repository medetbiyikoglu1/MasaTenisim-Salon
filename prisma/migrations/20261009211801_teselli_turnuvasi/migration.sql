-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bracket" TEXT NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "consolation" BOOLEAN NOT NULL DEFAULT false;
