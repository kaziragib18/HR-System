-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "consumeType" TEXT NOT NULL DEFAULT 'FULL_DAY',
ADD COLUMN     "location" TEXT;
