-- AlterTable
ALTER TABLE "Office" ADD COLUMN     "workStartTime" TEXT NOT NULL DEFAULT '09:00',
ADD COLUMN     "workEndTime" TEXT NOT NULL DEFAULT '17:00',
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: BD keeps its existing hardcoded shift hours and becomes the
-- permanent default office; UK already matches the new columns' defaults.
UPDATE "Office" SET "workStartTime" = '13:30', "workEndTime" = '22:00', "isDefault" = true WHERE "code" = 'BD';
