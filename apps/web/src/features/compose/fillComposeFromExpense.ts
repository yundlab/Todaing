import type { Expense } from "@/features/expenses/api";
import { pad2, yyyyMmDdLocal } from "@/domain/date";
import { normalizeCategory } from "@/domain/categoryUi";
import { formatAmountInputWithCommas } from "@/domain/parseAmountInput";
import { emptyTransit1Leg, type TransitLeg, type Transit2SegmentDraft } from "@/domain/transitPayload";
import { transitSegmentToLeg, transit1LegsWithAmountFallback } from "@/domain/transitLegRestore";
import { expensePersistedId } from "@/domain/expenseDayUsage";
import { loadCapitalMetroStations } from "@/features/transit/stations";
import type { FillComposeDispatchers } from "./fillComposeTypes";

export async function fillComposeFromExpense(e: Expense, d: FillComposeDispatchers): Promise<void> {
  await loadCapitalMetroStations();
  const base = d.resolveOriginalExpense(e);
  d.setComposeEditScheduleId(null);
  d.setComposeEditExpenseId(expensePersistedId(base));
  d.setComposeDayKey(yyyyMmDdLocal(new Date(base.occurredAt)));
  d.setComposeKind("expense");
  d.setScheduleWithExpense(false);
  d.setSchedulePayTimeText("");
  d.setSchedulePeopleText("");
  d.setScheduleShowOnCalendar(false);
  const od = new Date(base.occurredAt);
  d.setEntryStartText(`${pad2(od.getHours())}:${pad2(od.getMinutes())}`);
  if (base.endAt) {
    const ed = new Date(base.endAt);
    d.setEntryEndText(`${pad2(ed.getHours())}:${pad2(ed.getMinutes())}`);
  } else {
    d.setEntryEndText("");
  }
  d.setEntryCategory(base.category);
  d.setEntryTitle("");
  d.setExDetail((base.detail ?? "").trim());
  d.setExMerchant(base.merchant ?? "");
  d.setEntryNote((base.memo ?? "").trim());
  d.setExAmount(formatAmountInputWithCommas(String(base.amount)));
  d.setExPaymentType(base.paymentType);
  d.setExPaymentLabel(base.paymentMethodLabel ?? "");
  d.setExInstallment(base.paymentType === "CARD" && !!base.installment);
  d.setExInstallmentMonths(
    base.paymentType === "CARD" &&
      base.installment &&
      base.installmentMonths != null &&
      base.installmentMonths >= 2 &&
      base.installmentMonths <= 36
      ? base.installmentMonths
      : 2
  );
  d.setExInstallmentNoInterest(
    base.paymentType === "CARD" && !!base.installment && !!base.installmentNoInterest
  );
  const owner = base.paymentOwner ?? "나";
  d.setPayerPreset(owner === "나" ? "나" : "기타");
  d.setPayerOther(owner === "나" ? "" : owner);
  d.setExpenseScope(base.scope ?? "PERSONAL");
  if (base.scope === "SHARED") {
    d.setSharedNamesText(
      Array.isArray(base.participants) ? (base.participants as unknown[]).map(String).join(", ") : ""
    );
    d.setExpenseCompanionsText("");
  } else {
    d.setSharedNamesText("");
    d.setExpenseCompanionsText(
      Array.isArray(base.participants) && base.participants.length
        ? (base.participants as unknown[]).map(String).join(", ")
        : ""
    );
  }

  if (base.plannedAt) {
    const planned = new Date(base.plannedAt);
    const occurred = new Date(base.occurredAt);
    const sameMoment = planned.getTime() === occurred.getTime();
    if (!sameMoment && !Number.isNaN(planned.getTime())) {
      d.setPlannedAtEnabled(true);
      d.setPlannedUsageDayKey(yyyyMmDdLocal(planned));
      d.setPlannedUsageStartText(`${pad2(planned.getHours())}:${pad2(planned.getMinutes())}`);
      if (base.plannedEndAt) {
        const pe = new Date(base.plannedEndAt);
        d.setPlannedUsageEndText(`${pad2(pe.getHours())}:${pad2(pe.getMinutes())}`);
      } else {
        d.setPlannedUsageEndText("");
      }
      const pm = (base.plannedMemo ?? "").trim();
      const pc = (base.plannedContent ?? "").trim();
      if (pc) {
        d.setPlannedUsageTitle(pm);
        d.setPlannedUsageContent(pc);
      } else if (pm) {
        d.setPlannedUsageTitle("");
        d.setPlannedUsageContent(pm);
      } else {
        const mf = (base.memo ?? "").trim();
        if (mf) {
          d.setPlannedUsageTitle(mf);
          d.setPlannedUsageContent(mf);
        } else {
          d.setPlannedUsageTitle("");
          d.setPlannedUsageContent("");
        }
      }
      d.setPlannedUsageDetail((base.plannedDetail ?? "").trim());
      d.setPlannedUsageCompanionsText((base.plannedCompanionsText ?? "").trim());
    } else {
      d.setPlannedAtEnabled(false);
      d.setPlannedUsageDayKey("");
      d.setPlannedUsageStartText("");
      d.setPlannedUsageEndText("");
      d.setPlannedUsageTitle("");
      d.setPlannedUsageContent("");
      d.setPlannedUsageDetail("");
      d.setPlannedUsageCompanionsText("");
    }
  } else {
    d.setPlannedAtEnabled(false);
    d.setPlannedUsageDayKey("");
    d.setPlannedUsageStartText("");
    d.setPlannedUsageEndText("");
    d.setPlannedUsageTitle("");
    d.setPlannedUsageContent("");
    d.setPlannedUsageDetail("");
    d.setPlannedUsageCompanionsText("");
  }

  if (normalizeCategory(base.category) === "교통1") {
    const seg = base.transitSegments;
    if (Array.isArray(seg) && seg.length) {
      d.setTransitLegs(() => {
        const mapped = seg.map(transitSegmentToLeg).filter((x): x is TransitLeg => x != null);
        const legs: TransitLeg[] = mapped.length ? mapped : [emptyTransit1Leg()];
        return transit1LegsWithAmountFallback(legs, base.amount);
      });
    } else {
      d.setTransitLegs([
        {
          ...emptyTransit1Leg(),
          amount: base.amount > 0 ? formatAmountInputWithCommas(String(base.amount)) : ""
        }
      ]);
    }
  } else {
    d.setTransitLegs([emptyTransit1Leg()]);
  }
  if (normalizeCategory(base.category) === "교통2") {
    const seg = base.transitSegments;
    const occurredDayKey = yyyyMmDdLocal(new Date(base.occurredAt));
    if (Array.isArray(seg) && seg.length && typeof seg[0] === "object") {
      const mapped = seg
        .map((s: Record<string, unknown>) => {
          const dayKeySeg = typeof s?.dayKey === "string" ? s.dayKey : occurredDayKey;
          const start = typeof s?.start === "string" ? s.start : "";
          const end = typeof s?.end === "string" ? s.end : "";
          const fromText = typeof s?.from === "string" ? s.from : (base.transitFrom ?? "");
          const toText = typeof s?.to === "string" ? s.to : (base.transitTo ?? "");
          const mode = typeof s?.mode === "string" ? s.mode : (base.transitMode ?? "🚆");
          const memoText = typeof s?.memo === "string" ? s.memo : "";
          return { dayKey: dayKeySeg, start, end, fromText, toText, mode, memoText };
        })
        .filter(Boolean) as Transit2SegmentDraft[];

      d.setTransit2SegmentsDraft(
        mapped.length
          ? mapped
          : [
              {
                dayKey: occurredDayKey,
                start: "",
                end: "",
                fromText: base.transitFrom ?? "",
                toText: base.transitTo ?? "",
                mode: base.transitMode ?? "🚆",
                memoText: ""
              }
            ]
      );

      const first = mapped[0];
      d.setExTransitMode(first?.mode ?? base.transitMode ?? "🚆");
      d.setExTransitFromText(first?.fromText ?? base.transitFrom ?? "");
      d.setExTransitToText(first?.toText ?? base.transitTo ?? "");
    } else {
      const mode = (base.transitMode ?? "").trim() || "🚆";
      const from = (base.transitFrom ?? "").trim();
      const to = (base.transitTo ?? "").trim();
      d.setExTransitMode(mode);
      d.setExTransitFromText(from);
      d.setExTransitToText(to);
      d.setTransit2SegmentsDraft([{ dayKey: occurredDayKey, start: "", end: "", fromText: from, toText: to, mode, memoText: "" }]);
    }
  } else {
    d.setExTransitMode("🚆");
    d.setExTransitFromText("");
    d.setExTransitToText("");
    d.setTransit2SegmentsDraft([
      { dayKey: yyyyMmDdLocal(new Date(base.occurredAt)), start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
    ]);
  }
}
