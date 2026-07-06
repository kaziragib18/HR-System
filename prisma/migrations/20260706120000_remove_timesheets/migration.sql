-- DropForeignKey
ALTER TABLE "Timesheet" DROP CONSTRAINT "Timesheet_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "TimesheetEntry" DROP CONSTRAINT "TimesheetEntry_timesheetId_fkey";

-- DropTable
DROP TABLE "Timesheet";

-- DropTable
DROP TABLE "TimesheetEntry";
