import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";

export const schedulesRouter = Router();

const scheduleCreateSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  title: z.string().min(1).max(80),
  note: z.string().max(500).nullable().optional()
});

const scheduleUpdateSchema = scheduleCreateSchema.partial();

schedulesRouter.get("/", async (req, res) => {
  const day = typeof req.query.day === "string" ? req.query.day : null; // YYYY-MM-DD
  if (!day) {
    res.status(400).send("day query param required (YYYY-MM-DD)");
    return;
  }

  const start = new Date(`${day}T00:00:00.000`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const items = await prisma.scheduleItem.findMany({
    where: { startAt: { gte: start, lt: end } },
    orderBy: { startAt: "asc" }
  });

  res.json({ items });
});

schedulesRouter.post("/", async (req, res) => {
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
      startAt,
      endAt,
      title: parsed.data.title,
      note: parsed.data.note ?? null
    }
  });

  res.status(201).json(created);
});

schedulesRouter.patch("/:id", async (req, res) => {
  const id = req.params.id;
  const parsed = scheduleUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).send(parsed.error.issues.map((i) => i.message).join(", "));
    return;
  }

  const existing = await prisma.scheduleItem.findUnique({ where: { id } });
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
      note: parsed.data.note === undefined ? undefined : parsed.data.note ?? null
    }
  });

  res.json(updated);
});

schedulesRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  const existing = await prisma.scheduleItem.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).send("not found");
    return;
  }
  await prisma.scheduleItem.delete({ where: { id } });
  res.status(204).send();
});

