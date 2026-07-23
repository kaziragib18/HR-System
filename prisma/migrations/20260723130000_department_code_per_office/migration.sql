-- Department.code moves from globally unique to unique-per-office, so the
-- same code (e.g. "ACC") can exist independently in BD and UK.
DROP INDEX "Department_code_key";
DROP INDEX "Department_officeId_idx";
CREATE UNIQUE INDEX "Department_officeId_code_key" ON "Department"("officeId", "code");
