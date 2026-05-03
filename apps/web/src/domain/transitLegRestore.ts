import type { TransitLeg } from "./transitPayload";
import { STATIONS } from "../features/transit/stations";
import { formatAmountInputWithCommas, parseAmountInput } from "./parseAmountInput";

function stationFromPersistedName(name: string | null | undefined) {
  const n = String(name ?? "").trim();
  if (!n) return null;
  const hits = STATIONS.filter((s) => s.name === n);
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) return [...hits].sort((a, b) => a.name.localeCompare(b.name, "ko"))[0]!;
  const partial = STATIONS.filter((s) => s.name.includes(n));
  return partial.length ? partial.sort((a, b) => a.name.localeCompare(b.name, "ko"))[0]! : null;
}

function formatPersistedSegmentAmount(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number" && Number.isFinite(raw)) return formatAmountInputWithCommas(String(Math.trunc(raw)));
  const s = String(raw).trim();
  if (!s) return "";
  return formatAmountInputWithCommas(s);
}

export function transitSegmentToLeg(s: unknown): TransitLeg | null {
  if (!s || typeof s !== "object") return null;
  const o = s as Record<string, unknown>;
  const amount = formatPersistedSegmentAmount(o.amount);
  if (o.mode === "BUS") {
    return {
      mode: "BUS",
      start: String(o.start ?? ""),
      end: String(o.end ?? ""),
      busNumber: String(o.busNumber ?? ""),
      from: String(o.from ?? ""),
      to: String(o.to ?? ""),
      amount
    };
  }
  if (o.mode === "SUBWAY") {
    return {
      mode: "SUBWAY",
      start: String(o.start ?? ""),
      end: String(o.end ?? ""),
      from: stationFromPersistedName(typeof o.from === "string" ? o.from : null),
      to: stationFromPersistedName(typeof o.to === "string" ? o.to : null),
      line: String(o.line ?? ""),
      amount
    };
  }
  return null;
}

/** 구간에 금액이 없는 예전 데이터: 총액을 첫 구간에 넣어 수정·저장이 가능하도록 */
export function transit1LegsWithAmountFallback(legs: TransitLeg[], expenseTotalWon: number): TransitLeg[] {
  if (!legs.length || expenseTotalWon <= 0) return legs;
  const hasAny = legs.some((leg) => parseAmountInput(String((leg as { amount?: string }).amount ?? "")) != null);
  if (hasAny) return legs;
  const next = [...legs];
  const first = next[0]!;
  next[0] = { ...(first as object), amount: formatAmountInputWithCommas(String(expenseTotalWon)) } as TransitLeg;
  return next;
}
