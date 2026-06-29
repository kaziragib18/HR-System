-- AlterTable
ALTER TABLE "LeaveApplication" ADD COLUMN     "cancelApprovedAt" TIMESTAMP(3),
ADD COLUMN     "cancelApprovedById" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelRequestedAt" TIMESTAMP(3);
