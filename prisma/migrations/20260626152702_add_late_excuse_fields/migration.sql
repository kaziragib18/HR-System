-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "excuseReviewedAt" TIMESTAMP(3),
ADD COLUMN     "excuseReviewedBy" TEXT,
ADD COLUMN     "excuseStatus" TEXT,
ADD COLUMN     "lateExcuse" TEXT;
