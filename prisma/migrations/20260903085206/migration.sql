/*
  Warnings:

  - The `attachmentUrls` column on the `service_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `completionPhotoUrls` column on the `service_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('CREDENTIAL', 'GOOGLE');

-- AlterTable
ALTER TABLE "service_requests" DROP COLUMN "attachmentUrls",
ADD COLUMN     "attachmentUrls" JSONB,
DROP COLUMN "completionPhotoUrls",
ADD COLUMN     "completionPhotoUrls" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authProvider" "AuthProvider" NOT NULL DEFAULT 'CREDENTIAL',
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "profileImagePublicId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
