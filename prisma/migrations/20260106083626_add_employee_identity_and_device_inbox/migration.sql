/*
  Warnings:

  - A unique constraint covering the columns `[companyId,cardNo]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[companyId,deviceUserId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "DeviceInboxStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "cardNo" VARCHAR(100),
ADD COLUMN     "deviceUserId" VARCHAR(100);

-- CreateTable
CREATE TABLE "DeviceInboxEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deviceId" TEXT,
    "doorId" TEXT,
    "externalRef" VARCHAR(200) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "EventDirection" NOT NULL,
    "cardNo" VARCHAR(100),
    "deviceUserId" VARCHAR(100),
    "status" "DeviceInboxStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedEmployeeId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "ignoredAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceInboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceInboxEvent_companyId_status_occurredAt_idx" ON "DeviceInboxEvent"("companyId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "DeviceInboxEvent_companyId_deviceId_occurredAt_idx" ON "DeviceInboxEvent"("companyId", "deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "DeviceInboxEvent_companyId_cardNo_idx" ON "DeviceInboxEvent"("companyId", "cardNo");

-- CreateIndex
CREATE INDEX "DeviceInboxEvent_companyId_deviceUserId_idx" ON "DeviceInboxEvent"("companyId", "deviceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInboxEvent_companyId_externalRef_key" ON "DeviceInboxEvent"("companyId", "externalRef");

-- CreateIndex
CREATE INDEX "Employee_companyId_cardNo_idx" ON "Employee"("companyId", "cardNo");

-- CreateIndex
CREATE INDEX "Employee_companyId_deviceUserId_idx" ON "Employee"("companyId", "deviceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_cardNo_key" ON "Employee"("companyId", "cardNo");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_deviceUserId_key" ON "Employee"("companyId", "deviceUserId");

-- AddForeignKey
ALTER TABLE "DeviceInboxEvent" ADD CONSTRAINT "DeviceInboxEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInboxEvent" ADD CONSTRAINT "DeviceInboxEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInboxEvent" ADD CONSTRAINT "DeviceInboxEvent_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInboxEvent" ADD CONSTRAINT "DeviceInboxEvent_resolvedEmployeeId_fkey" FOREIGN KEY ("resolvedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
