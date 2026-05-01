-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "transitFrom" TEXT,
ADD COLUMN     "transitLine" TEXT,
ADD COLUMN     "transitTo" TEXT;
