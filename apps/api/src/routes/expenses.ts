import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

export const expensesRouter = Router();

const expenseCreateSchema = z.object({
  occurredAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  // Allow 0 for "amount not set yet" (UI hides 0)
  amount: z.number().int().nonnegative(),
  category: z.string().min(1).max(40),
  merchant: z.string().max(60).nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
  detail: z.string().max(200).nullable().optional(),
  memo: z.string().max(200).nullable().optional(),
  paymentType: z.enum(["CARD", "CASH", "ACCOUNT", "ETC"]).optional(),
  paymentOwner: z.string().max(40).nullable().optional(),
  paymentMethodLabel: z.string().max(60).nullable().optional(),
  installment: z.boolean().optional(),
  installmentMonths: z.number().int().min(2).max(36).nullable().optional(),
  installmentNoInterest: z.boolean().optional(),
  // 결제일(occurredAt)과 다른 사용 예정/실제일. null이면 결제일과 동일.
  plannedAt: z.string().datetime().nullable().optional(),
  plannedEndAt: z.string().datetime().nullable().optional(),
  plannedMemo: z.string().max(200).nullable().optional(),
  plannedContent: z.string().max(200).nullable().optional(),
  plannedDetail: z.string().max(200).nullable().optional(),
  plannedCompanionsText: z.string().max(200).nullable().optional(),
  scope: z.enum(["PERSONAL", "SHARED"]).optional(),
  participants: z.unknown().nullable().optional(),
  transitFrom: z.string().max(40).nullable().optional(),
  transitTo: z.string().max(40).nullable().optional(),
  transitLine: z.string().max(20).nullable().optional(),
  transitMode: z.string().max(10).nullable().optional(),
  transitVia: z.string().max(200).nullable().optional(),
  transitBusNumber: z.string().max(20).nullable().optional(),
  transitSegments: z.unknown().nullable().optional()
});

const expenseUpdateSchema = expenseCreateSchema.partial();

type ExpenseCreate = z.infer<typeof expenseCreateSchema>;
type ExpenseUpdate = z.infer<typeof expenseUpdateSchema>;

/** PATCH 시: 키가 누락이면 변경 안 함, 명시적 null이면 null 저장. */
function patchNullable<T>(value: T | null | undefined): T | null | undefined {
  return value === undefined ? undefined : value ?? null;
}

/** Prisma Json 컬럼: 누락이면 변경 안 함, null이면 DbNull 저장. */
function patchJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

function sendZodError(
  res: Parameters<Parameters<typeof expensesRouter.post>[1]>[1],
  err: z.ZodError
) {
  res.status(400).send(err.issues.map((i) => i.message).join(", "));
}

expensesRouter.get("/", async (req: Request, res) => {
  const userId = req.userId!;
  // 클라이언트가 월·일 합계·타임라인을 목록으로 계산하므로, 상한만 두고 충분히 넓게 반환합니다.
  const items = await prisma.expense.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 5000
  });
  res.json({ items });
});

expensesRouter.get("/summary", async (req: Request, res) => {
  const userId = req.userId!;
  const day = typeof req.query.day === "string" ? req.query.day : null; // YYYY-MM-DD
  if (!day) {
    res.status(400).send("day query param required (YYYY-MM-DD)");
    return;
  }

  // Interpret day boundary in KST to match client dayKey (YYYY-MM-DD local)
  const start = new Date(`${day}T00:00:00.000+09:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const items = await prisma.expense.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    select: { amount: true, category: true }
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    total += it.amount;
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + it.amount);
  }

  res.json({
    day,
    total,
    byCategory: Object.fromEntries(byCategory.entries())
  });
});

expensesRouter.get("/monthly-summary", async (req: Request, res) => {
  const userId = req.userId!;
  const month = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
  if (!month) {
    res.status(400).send("month query param required (YYYY-MM)");
    return;
  }

  // Interpret month boundary in KST to match client monthKey (YYYY-MM local)
  const start = new Date(`${month}-01T00:00:00.000+09:00`);
  if (Number.isNaN(start.getTime())) {
    res.status(400).send("invalid month");
    return;
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const items = await prisma.expense.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    select: { amount: true, category: true }
  });

  const byCategory = new Map<string, number>();
  let total = 0;
  for (const it of items) {
    total += it.amount;
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + it.amount);
  }

  res.json({
    month,
    total,
    byCategory: Object.fromEntries(byCategory.entries())
  });
});

expensesRouter.get("/:id", async (req: Request, res) => {
  const userId = req.userId!;
  const id = req.params.id;
  const item = await prisma.expense.findFirst({ where: { id, userId } });
  if (!item) {
    res.status(404).send("not found");
    return;
  }
  res.json(item);
});

function buildCreateData(data: ExpenseCreate, userId: string) {
  return {
    userId,
    occurredAt: new Date(data.occurredAt),
    endAt: data.endAt ? new Date(data.endAt) : null,
    amount: data.amount,
    category: data.category,
    merchant: data.merchant ?? null,
    subject: data.subject ?? null,
    detail: data.detail ?? null,
    memo: data.memo ?? null,
    paymentType: data.paymentType ?? "CARD",
    paymentOwner: data.paymentOwner ?? null,
    paymentMethodLabel: data.paymentMethodLabel ?? null,
    installment: data.installment ?? false,
    installmentMonths: data.installmentMonths ?? null,
    installmentNoInterest: data.installmentNoInterest ?? false,
    plannedAt: data.plannedAt ? new Date(data.plannedAt) : null,
    plannedEndAt: data.plannedEndAt ? new Date(data.plannedEndAt) : null,
    plannedMemo: data.plannedMemo ?? null,
    plannedContent: data.plannedContent ?? null,
    plannedDetail: data.plannedDetail ?? null,
    plannedCompanionsText: data.plannedCompanionsText ?? null,
    scope: data.scope ?? "PERSONAL",
    participants: patchJson(data.participants),
    transitFrom: data.transitFrom ?? null,
    transitTo: data.transitTo ?? null,
    transitLine: data.transitLine ?? null,
    transitMode: data.transitMode ?? null,
    transitVia: data.transitVia ?? null,
    transitBusNumber: data.transitBusNumber ?? null,
    transitSegments: patchJson(data.transitSegments)
  };
}

function buildUpdateData(data: ExpenseUpdate) {
  return {
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined,
    endAt:
      data.endAt === undefined ? undefined : data.endAt ? new Date(data.endAt) : null,
    // 0도 유효한 값이므로 nullish coalescing(??) 사용 금지 (0이면 업데이트가 누락됨)
    amount: data.amount === undefined ? undefined : data.amount,
    category: data.category ?? undefined,
    merchant: patchNullable(data.merchant),
    subject: patchNullable(data.subject),
    detail: patchNullable(data.detail),
    memo: patchNullable(data.memo),
    paymentType: data.paymentType ?? undefined,
    paymentOwner: patchNullable(data.paymentOwner),
    paymentMethodLabel: patchNullable(data.paymentMethodLabel),
    installment: data.installment ?? undefined,
    installmentMonths: patchNullable(data.installmentMonths),
    installmentNoInterest: data.installmentNoInterest ?? undefined,
    plannedAt:
      data.plannedAt === undefined
        ? undefined
        : data.plannedAt
          ? new Date(data.plannedAt)
          : null,
    plannedEndAt:
      data.plannedEndAt === undefined
        ? undefined
        : data.plannedEndAt
          ? new Date(data.plannedEndAt)
          : null,
    plannedMemo: patchNullable(data.plannedMemo),
    plannedContent: patchNullable(data.plannedContent),
    plannedDetail: patchNullable(data.plannedDetail),
    plannedCompanionsText: patchNullable(data.plannedCompanionsText),
    scope: data.scope ?? undefined,
    participants: patchJson(data.participants),
    transitFrom: patchNullable(data.transitFrom),
    transitTo: patchNullable(data.transitTo),
    transitVia: patchNullable(data.transitVia),
    transitLine: patchNullable(data.transitLine),
    transitMode: patchNullable(data.transitMode),
    transitBusNumber: patchNullable(data.transitBusNumber),
    transitSegments: patchJson(data.transitSegments)
  };
}

expensesRouter.post("/", async (req: Request, res) => {
  const userId = req.userId!;
  const parsed = expenseCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error);
    return;
  }

  const created = await prisma.expense.create({ data: buildCreateData(parsed.data, userId) });
  res.status(201).json(created);
});

expensesRouter.patch("/:id", async (req: Request, res) => {
  const userId = req.userId!;
  const id = req.params.id;
  const parsed = expenseUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error);
    return;
  }

  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).send("not found");
    return;
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: buildUpdateData(parsed.data)
  });

  res.json(updated);
});

expensesRouter.delete("/:id", async (req: Request, res) => {
  const userId = req.userId!;
  const id = req.params.id;
  const existing = await prisma.expense.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).send("not found");
    return;
  }
  await prisma.expense.delete({ where: { id } });
  res.status(204).send();
});
