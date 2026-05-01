-- CreateEnum
CREATE TYPE "ExpenseScope" AS ENUM ('PERSONAL', 'SHARED');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "participants" JSONB,
ADD COLUMN     "scope" "ExpenseScope" NOT NULL DEFAULT 'PERSONAL';
