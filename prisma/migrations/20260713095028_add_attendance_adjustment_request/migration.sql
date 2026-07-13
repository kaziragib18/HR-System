-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "adjustmentApproverId" TEXT,
ADD COLUMN     "adjustmentReason" TEXT,
ADD COLUMN     "adjustmentReviewedAt" TIMESTAMP(3),
ADD COLUMN     "adjustmentReviewedBy" TEXT,
ADD COLUMN     "adjustmentStatus" TEXT,
ADD COLUMN     "requestedCheckIn" TIMESTAMP(3),
ADD COLUMN     "requestedCheckOut" TIMESTAMP(3);
