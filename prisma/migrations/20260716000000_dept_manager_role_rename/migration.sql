-- Rename the TEAM_LEAD role to DEPT_MANAGER (same hierarchy position, new name)
ALTER TABLE "Attendance" ADD COLUMN "excuseApproverId" TEXT;

UPDATE "User" SET "role" = 'DEPT_MANAGER' WHERE "role" = 'TEAM_LEAD';
