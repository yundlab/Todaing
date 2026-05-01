-- 결제일(occurredAt)과 다른 "사용 예정/실제일"
-- null이면 결제일과 동일한 것으로 취급한다.
ALTER TABLE "Expense" ADD COLUMN "plannedAt" TIMESTAMP(3);

-- 캘린더 표시 시 plannedAt 기준 조회를 위한 인덱스
CREATE INDEX "Expense_plannedAt_idx" ON "Expense"("plannedAt");
