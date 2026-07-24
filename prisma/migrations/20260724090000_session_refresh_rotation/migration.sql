-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "previousRefreshToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_previousRefreshToken_key" ON "Session"("previousRefreshToken");
