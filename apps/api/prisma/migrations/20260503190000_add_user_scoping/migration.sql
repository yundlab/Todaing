-- 사용자별 데이터 분리: User + Expense/ScheduleItem.userId
-- 기존 행은 마이그레이션 전용 사용자에 붙입니다. 실제 구글 계정으로 옮기려면 DB에서 userId를 해당 User id로 UPDATE 하세요.

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "picture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Expense" ADD COLUMN "userId" TEXT;
ALTER TABLE "ScheduleItem" ADD COLUMN "userId" TEXT;

INSERT INTO "User" ("id", "email", "name", "picture", "createdAt", "updatedAt")
VALUES (
    'cmig_legacy_data',
    'legacy-data@todaing.internal',
    'Legacy (migration)',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

UPDATE "Expense" SET "userId" = 'cmig_legacy_data' WHERE "userId" IS NULL;
UPDATE "ScheduleItem" SET "userId" = 'cmig_legacy_data' WHERE "userId" IS NULL;

ALTER TABLE "Expense" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "ScheduleItem" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Expense_userId_idx" ON "Expense"("userId");
CREATE INDEX "ScheduleItem_userId_idx" ON "ScheduleItem"("userId");
