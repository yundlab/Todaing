import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import {
  mergeYearlyIntoDayWindow,
  mergeYearlyIntoMonthWindow,
  type ScheduleRow
} from "../scheduleRepeatYearly.js";

export const schedulesRouter = Router();

const scheduleCreateSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(80),
  note: z.string().max(500).nullable().optional(),
  showOnCalendar: z.boolean().optional(),
  repeatYearly: z.boolean().optional()
});

const scheduleUpdateSchema = scheduleCreateSchema.partial();

schedulesRouter.get("/", async (req: Request, res) => {
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

  const [inRange, yearlyRows] = await Promise.all([
    prisma.scheduleItem.findMany({
      where: { userId, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" }
    }),
    prisma.scheduleItem.findMany({
      where: { userId, repeatYearly: true }
    })
  ]);

  const items = mergeYearlyIntoDayWindow(
    inRange as ScheduleRow[],
    yearlyRows as ScheduleRow[],
    day,
    start,
    end
  );

  res.json({ items });
});

schedulesRouter.get("/month", async (req: Request, res) => {
  const userId = req.userId!;
  const month = typeof req.query.month === "string" ? req.query.month : null; // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).send("month query param required (YYYY-MM)");
    return;
  }
  const onlyCalendar = req.query.onlyCalendar === "1" || req.query.onlyCalendar === "true";

  // Interpret month boundary in KST to match client monthKey (YYYY-MM local)
  const start = new Date(`${month}-01T00:00:00.000+09:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const [inRange, yearlyRows] = await Promise.all([
    prisma.scheduleItem.findMany({
      where: {
        userId,
        startAt: { gte: start, lt: end },
        ...(onlyCalendar ? { showOnCalendar: true } : {})
      },
      orderBy: { startAt: "asc" }
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId,
        repeatYearly: true,
        ...(onlyCalendar ? { showOnCalendar: true } : {})
      }
    })
  ]);

  const items = mergeYearlyIntoMonthWindow(
    inRange as ScheduleRow[],
    yearlyRows as ScheduleRow[],
    month,
    start,
    end
  );

  res.json({ items });
});

schedulesRouter.post("/", async (req: Request, res) => {
  const userId = req.userId!;
  const parsed = scheduleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send(parsed.error.issues.map((i) => i.message).join(", "));
    return;
  }

  const startAt = new Date(parsed.data.startAt);
  const endAt =
    parsed.data.endAt == null || parsed.data.endAt === undefined ? null : new Date(parsed.data.endAt);
  if (endAt != null && !(startAt < endAt)) {
    res.status(400).send("startAt must be before endAt");
    return;
  }

  const created = await prisma.scheduleItem.create({
    data: {
      userId,
      startAt,
      endAt,
      title: parsed.data.title,
      note: parsed.data.note ?? null,
      showOnCalendar: parsed.data.showOnCalendar ?? true,
      repeatYearly: parsed.data.repeatYearly ?? false
    }
  });

  res.status(201).json(created);
});

schedulesRouter.patch("/:id", async (req: Request, res) => {
  const userId = req.userId!;
  const id = req.params.id;
  const parsed = scheduleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send(parsed.error.issues.map((i) => i.message).join(", "));
    return;
  }

  const existing = await prisma.scheduleItem.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).send("not found");
    return;
  }

  const nextStartAt = parsed.data.startAt ? new Date(parsed.data.startAt) : existing.startAt;
  const nextEndAt =
    parsed.data.endAt === undefined
      ? existing.endAt
      : parsed.data.endAt === null
        ? null
        : new Date(parsed.data.endAt);
  if (nextEndAt != null && !(nextStartAt < nextEndAt)) {
    res.status(400).send("startAt must be before endAt");
    return;
  }

  const updated = await prisma.scheduleItem.update({
    where: { id },
    data: {
      startAt: parsed.data.startAt ? nextStartAt : undefined,
      endAt: parsed.data.endAt === undefined ? undefined : nextEndAt,
      title: parsed.data.title ?? undefined,
      note: parsed.data.note === undefined ? undefined : parsed.data.note ?? null,
      showOnCalendar: parsed.data.showOnCalendar === undefined ? undefined : parsed.data.showOnCalendar,
      repeatYearly: parsed.data.repeatYearly === undefined ? undefined : parsed.data.repeatYearly
    }
  });

  res.json(updated);
});

schedulesRouter.delete("/:id", async (req: Request, res) => {
  const userId = req.userId!;
  const id = req.params.id;
  const existing = await prisma.scheduleItem.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).send("not found");
    return;
  }
  await prisma.scheduleItem.delete({ where: { id } });
  res.status(204).send();
});

