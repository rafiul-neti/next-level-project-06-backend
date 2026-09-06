-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "finalAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "technician_profiles" ALTER COLUMN "yearsOfExperience" SET DEFAULT 0;
