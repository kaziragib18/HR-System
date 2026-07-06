-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "isBloodDonor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDonationDate" TIMESTAMP(3),
ADD COLUMN     "nomineeInfo" JSONB;

