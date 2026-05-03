import type { Expense } from "@/features/expenses/api";

export function formatWon(amount: number) {
  return `${amount.toLocaleString()}원`;
}

/**
 * N분의1에 포함될 사람만(결제자는 별도 `paymentOwner`로 둠).
 * - 예외: **내가 결제**인데 공동 명단에 상대만 적힌 레거시 → `나`만 자동 보강.
 * - **기타(제3자) 결제**는 명단에 적은 사람만 나눔(결제자를 배열에 넣지 않음).
 */
export function sharedSplitMemberNames(payer: string | null, participantNames: string[]): string[] {
  const names = Array.from(new Set(participantNames.map((s) => String(s).trim()).filter(Boolean)));
  const p = (payer ?? "").trim();
  if (p && !names.includes(p) && p === "나") {
    names.push(p);
  }
  return names;
}

export function sharedParticipantsAll(payer: string | null, participants: unknown): string[] | null {
  const base = Array.isArray(participants) ? participants : null;
  if (!base) return null;
  const raw = base.map((x) => String(x).trim()).filter(Boolean);
  if (!raw.length) return null;
  const names = sharedSplitMemberNames(payer, raw);
  return names.length ? names : null;
}

export function participantsCount(e: Expense): number | null {
  if (e.scope !== "SHARED") return null;
  const all = sharedParticipantsAll(e.paymentOwner, e.participants);
  return all ? all.length : null;
}

/** 카드·상세에 표시할 때만 사용: 함께한 사람 목록에서 `me`(기본 "나")는 빼고 보여줌 */
export function participantsDisplayWithoutMe(participants: unknown, me = "나"): string {
  if (!Array.isArray(participants)) return "";
  const names = participants.map((x) => String(x).trim()).filter(Boolean);
  const rest = names.filter((n) => n !== me);
  return rest.length ? rest.join(", ") : names.join(", ");
}

/** 결제자 제외 동행·N분의1 정산 멤버 표기 (개인 지출의 선택 동행은 결제자 미포함 배열로 저장) */
export function companionsExcludingPayerLabel(e: Expense): string {
  const payer = (e.paymentOwner ?? "").trim();
  if (!Array.isArray(e.participants) || e.participants.length === 0) return "";
  const names = e.participants.map((x) => String(x).trim()).filter(Boolean);
  if (!payer) return names.join(", ");
  return names.filter((n) => n !== payer).join(", ");
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

