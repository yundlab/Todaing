-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CARD', 'CASH', 'ACCOUNT', 'ETC');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "detail" TEXT,
ADD COLUMN     "installment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "installmentMonths" INTEGER,
ADD COLUMN     "merchant" TEXT,
ADD COLUMN     "paymentMethodLabel" TEXT,
ADD COLUMN     "paymentOwner" TEXT,
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'CARD';

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleItem_startAt_idx" ON "ScheduleItem"("startAt");

-- CreateIndex
CREATE INDEX "ScheduleItem_endAt_idx" ON "ScheduleItem"("endAt");
