import type { Expense } from "../features/expenses/api";

export function formatWon(amount: number) {
  return `${amount.toLocaleString()}원`;
}

export function sharedParticipantsAll(payer: string | null, participants: unknown): string[] | null {
  const base = Array.isArray(participants) ? participants : null;
  if (!base) return null;
  const names = base.map((x) => String(x).trim()).filter(Boolean);
  if (payer) names.push(String(payer).trim());
  const uniq = Array.from(new Set(names)).filter(Boolean);
  return uniq.length >= 2 ? uniq : null;
}

export function participantsCount(e: Expense): number | null {
  if (e.scope !== "SHARED") return null;
  if (!Array.isArray(e.participants)) return null;
  const n = e.participants.length;
  return n >= 2 ? n : null;
}

/** 카드·상세에 표시할 때만 사용: 함께한 사람 목록에서 `me`(기본 "나")는 빼고 보여줌 */
export function participantsDisplayWithoutMe(participants: unknown, me = "나"): string {
  if (!Array.isArray(participants)) return "";
  const names = participants.map((x) => String(x).trim()).filter(Boolean);
  const rest = names.filter((n) => n !== me);
  return rest.length ? rest.join(", ") : names.join(", ");
}

export function myShareAmountForMe(e: Expense, me: string) {
  if (e.amount <= 0) return 0;
  if (e.scope !== "SHARED") return e.amount;
  const all = sharedParticipantsAll(e.paymentOwner, e.participants);
  if (!all || !all.includes(me)) return 0;
  return e.amount / all.length;
}

export function settlementLineForExpense(e: Expense, me: string) {
  if (e.amount <= 0) return null;
  const payer = (e.paymentOwner ?? "").trim();
  // PERSONAL: if someone else paid, I owe full amount (no split)
  if (e.scope !== "SHARED") {
    if (!payer || payer === me) return null;
    return { kind: "pay" as const, label: `개인 → ${payer}`, amount: e.amount };
  }

  const all = sharedParticipantsAll(e.paymentOwner, e.participants);
  if (!all || !all.includes(me)) return null;
  const n = all.length;
  const each = Math.round(e.amount / n);
  if (payer === me) {
    return { kind: "receive" as const, label: `${n}명 1/${n}`, amount: each * (n - 1) };
  }
  if (!payer) return null;
  return { kind: "pay" as const, label: `${n}명 1/${n} → ${payer}`, amount: each };
}

export function settlementDeltaForMe(e: Expense, me: string) {
  const perPerson = new Map<string, number>();
  if (e.amount <= 0) return { iPay: 0, iReceive: 0, perPerson };
  const payer = (e.paymentOwner ?? "").trim();

  // PERSONAL: if someone else paid, I owe full amount (no split)
  if (e.scope !== "SHARED") {
    if (!payer || payer === me) return { iPay: 0, iReceive: 0, perPerson };
    perPerson.set(payer, (perPerson.get(payer) ?? 0) - e.amount);
    return { iPay: e.amount, iReceive: 0, perPerson };
  }

  const all = sharedParticipantsAll(e.paymentOwner, e.participants);
  if (!all || !all.includes(me)) return { iPay: 0, iReceive: 0, perPerson };
  const n = all.length;
  const each = e.amount / n;
  // Positive = I should receive from that person, Negative = I should pay to that person
  if (payer === me) {
    for (const p of all) {
      if (p === me) continue;
      perPerson.set(p, (perPerson.get(p) ?? 0) + each);
    }
    return { iPay: 0, iReceive: each * (n - 1), perPerson };
  }
  if (!payer) return { iPay: 0, iReceive: 0, perPerson };
  perPerson.set(payer, (perPerson.get(payer) ?? 0) - each);
  return { iPay: each, iReceive: 0, perPerson };
}

export function settlementTransfersForMe(e: Expense, me: string) {
  if (e.amount <= 0) return [] as Array<{ from: string; to: string; amount: number }>;
  const payer = (e.paymentOwner ?? "").trim();

  if (e.scope !== "SHARED") {
    if (!payer || payer === me) return [];
    return [{ from: me, to: payer, amount: e.amount }];
  }

  const all = sharedParticipantsAll(e.paymentOwner, e.participants);
  if (!all || !all.includes(me) || !payer) return [];
  const n = all.length;
  const each = Math.round(e.amount / n);
  if (payer === me) {
    return all.filter((p) => p !== me).map((p) => ({ from: p, to: me, amount: each }));
  }
  return [{ from: me, to: payer, amount: each }];
}

