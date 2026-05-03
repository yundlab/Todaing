-- 다른 날 사용: 종료 시각·표시용 메모·세부·동행
ALTER TABLE "Expense" ADD COLUMN "plannedEndAt" TIMESTAMP(3);
ALTER TABLE "Expense" ADD COLUMN "plannedMemo" VARCHAR(200);
ALTER TABLE "Expense" ADD COLUMN "plannedDetail" VARCHAR(200);
ALTER TABLE "Expense" ADD COLUMN "plannedCompanionsText" VARCHAR(200);
