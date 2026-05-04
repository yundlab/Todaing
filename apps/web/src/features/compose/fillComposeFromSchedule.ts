import type { Expense } from "@/features/expenses/api";
import type { ScheduleItem } from "@/features/schedules/api";
import { pad2, yyyyMmDdLocal } from "@/domain/date";
import { normalizeCategory, parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { formatAmountInputWithCommas } from "@/domain/parseAmountInput";
import { emptyTransit1Leg, type TransitLeg, type Transit2SegmentDraft } from "@/domain/transitPayload";
import { transitSegmentToLeg, transit1LegsWithAmountFallback } from "@/domain/transitLegRestore";
import { parseScheduleNote } from "@/domain/scheduleNote";
import { loadCapitalMetroStations } from "@/features/transit/stations";
import type { FillComposeDispatchers } from "./fillComposeTypes";

export async function fillComposeFromSchedule(
  full: ScheduleItem,
  linked: Expense[],
  d: FillComposeDispatchers
): Promise<void> {
  await loadCapitalMetroStations();
  d.setComposeEditExpenseId(null);
  d.setComposeEditScheduleId(full.id);
  d.setComposeDayKey(yyyyMmDdLocal(new Date(full.startAt)));
  d.setComposeKind("schedule");
  d.setScheduleWithExpense(false);
  d.setSchedulePayTimeText("");
  d.setScheduleShowOnCalendar(Boolean(full.showOnCalendar));
  d.setScheduleRepeatYearly(Boolean(full.repeatYearly));

  const s = new Date(full.startAt);
  const startHhMm = `${pad2(s.getHours())}:${pad2(s.getMinutes())}`;
  const endHhMm = full.endAt
    ? `${pad2(new Date(full.endAt).getHours())}:${pad2(new Date(full.endAt).getMinutes())}`
    : "";
  const parsed = parseEmojiPrefixedTitle(full.title);
  if (parsed.category === "교통1" || parsed.category === "교통2") {
    d.setEntryStartText("");
    d.setEntryEndText("");
  } else {
    d.setEntryStartText(startHhMm);
    d.setEntryEndText(endHhMm);
  }
  d.setEntryCategory(parsed.category);
  d.setEntryTitle(parsed.content);
  const np = parseScheduleNote(full.note);
  d.setSchedulePeopleText(np.people.join(", "));
  d.setScheduleCancelled(Boolean(np.cancelled));
  const stripTransit2Line = (raw: string) =>
    raw
      .split("\n")
      .map((ln) => ln.trim())
      .filter(
        (ln) =>
          !(ln.includes("→") && (ln.startsWith("🚆") || ln.startsWith("🚍") || ln.startsWith("🚖") || ln.startsWith("✈")))
      )
      .join("\n")
      .trim();
  d.setEntryNote(stripTransit2Line(np.memo ?? ""));
  d.setScheduleExpenseTitle(parsed.content);

  d.setExAmount("");
  d.setExMerchant("");
  d.setExDetail(np.detail ?? "");
  d.setExPaymentType("CARD");
  d.setExPaymentLabel("");
  d.setPayerPreset("나");
  d.setPayerOther("");
  d.setExpenseScope("PERSONAL");
  d.setSharedNamesText("");
  d.setExpenseCompanionsText("");
  d.setExInstallment(false);
  d.setExInstallmentMonths(2);
  d.setExInstallmentNoInterest(false);

  const trExTransit1 = linked.find((x) => normalizeCategory(x.category) === "교통1");
  if (parsed.category === "교통1") {
    const seg = trExTransit1?.transitSegments;
    if (Array.isArray(seg) && seg.length) {
      d.setTransitLegs(() => {
        const mapped = seg.map(transitSegmentToLeg).filter((x): x is TransitLeg => x != null);
        const legs: TransitLeg[] = mapped.length ? mapped : [emptyTransit1Leg()];
        const totalWon = typeof trExTransit1?.amount === "number" ? trExTransit1.amount : 0;
        return transit1LegsWithAmountFallback(legs, totalWon);
      });
    } else {
      const amt = typeof trExTransit1?.amount === "number" ? trExTransit1.amount : 0;
      d.setTransitLegs([
        {
          ...emptyTransit1Leg(),
          amount: amt > 0 ? formatAmountInputWithCommas(String(amt)) : ""
        }
      ]);
    }
    if (trExTransit1 && typeof trExTransit1.amount === "number") {
      d.setExAmount(formatAmountInputWithCommas(String(trExTransit1.amount)));
    }
  } else {
    d.setTransitLegs([emptyTransit1Leg()]);
  }
  const scheduleDayKey = yyyyMmDdLocal(new Date(full.startAt));
  if (parsed.category === "교통2") {
    const tr2 = linked.find((x) => normalizeCategory(x.category) === "교통2");
    if (tr2) {
      d.setExTransitMode(tr2.transitMode ?? "🚆");
      d.setExTransitFromText(tr2.transitFrom ?? "");
      d.setExTransitToText(tr2.transitTo ?? "");
      const seg = tr2.transitSegments;
      if (Array.isArray(seg) && seg.length && typeof seg[0] === "object") {
        const mapped = seg
          .map((s: Record<string, unknown>) => {
            const dayKeySeg = typeof s?.dayKey === "string" ? s.dayKey : scheduleDayKey;
            const start = typeof s?.start === "string" ? s.start : "";
            const end = typeof s?.end === "string" ? s.end : "";
            const fromText = typeof s?.from === "string" ? s.from : (tr2.transitFrom ?? "");
            const toText = typeof s?.to === "string" ? s.to : (tr2.transitTo ?? "");
            const mode = typeof s?.mode === "string" ? s.mode : (tr2.transitMode ?? "🚆");
            const memoText = typeof s?.memo === "string" ? s.memo : "";
            return { dayKey: dayKeySeg, start, end, fromText, toText, mode, memoText };
          })
          .filter(Boolean) as Transit2SegmentDraft[];
        d.setTransit2SegmentsDraft(
          mapped.length
            ? mapped
            : [
                {
                  dayKey: scheduleDayKey,
                  start: "",
                  end: "",
                  fromText: tr2.transitFrom ?? "",
                  toText: tr2.transitTo ?? "",
                  mode: tr2.transitMode ?? "🚆",
                  memoText: ""
                }
              ]
        );
      } else {
        d.setTransit2SegmentsDraft([
          {
            dayKey: scheduleDayKey,
            start: "",
            end: "",
            fromText: tr2.transitFrom ?? "",
            toText: tr2.transitTo ?? "",
            mode: (tr2.transitMode ?? "").trim() || "🚆",
            memoText: ""
          }
        ]);
      }
    } else {
      const memo = np.memo ?? "";
      const transitLine = memo
        .split("\n")
        .map((ln) => ln.trim())
        .find((ln) => ln.includes("→") && (ln.startsWith("🚆") || ln.startsWith("🚍") || ln.startsWith("🚖") || ln.startsWith("✈")));
      if (transitLine) {
        const token = transitLine.trimStart().split(/\s+/)[0] ?? "";
        const rest = transitLine.trimStart().slice(token.length).trim();
        const [fromRaw, toRaw] = rest.split("→").map((x) => x.trim());
        d.setExTransitMode(token || "🚆");
        d.setExTransitFromText(fromRaw ?? "");
        d.setExTransitToText(toRaw ?? "");
        d.setTransit2SegmentsDraft([
          {
            dayKey: scheduleDayKey,
            start: "",
            end: "",
            fromText: fromRaw ?? "",
            toText: toRaw ?? "",
            mode: (token || "🚆").trim() || "🚆",
            memoText: ""
          }
        ]);
      } else {
        d.setExTransitMode("🚆");
        d.setExTransitFromText("");
        d.setExTransitToText("");
        d.setTransit2SegmentsDraft([
          { dayKey: scheduleDayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
        ]);
      }
    }
  } else {
    d.setExTransitMode("🚆");
    d.setExTransitFromText("");
    d.setExTransitToText("");
    d.setTransit2SegmentsDraft([
      { dayKey: scheduleDayKey, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
    ]);
  }
}
