import { useLayoutEffect, useMemo } from "react";
import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";
import { NATIVE_SELECT_CHEVRON_CLASS, NATIVE_SELECT_CHEVRON_STYLE } from "@/components/nativeSelectChevron";
import type { Station } from "@/features/transit/stations";
import {
  orderSubwayLineChoices,
  pickSubwayLineForPool,
  subwayLinePool,
  type SubwayLinePickContext
} from "@/domain/transitSubwayLines";
import { normalizeFourDigitTimeInput } from "@/domain/time";
import { emptyTransit1Leg } from "@/domain/transitPayload";
import { formatAmountInputWithCommas, parseAmountInput } from "@/domain/parseAmountInput";
import { formatWon } from "@/domain/settlement";

function CloseXIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type SubwayLegSlice = { from: Station | null; to: Station | null; line: string };

function linePickContextForLeg(
  legs: Array<{ mode: string; from?: unknown; to?: unknown; line?: string }>,
  idx: number,
  leg: SubwayLegSlice
): SubwayLinePickContext {
  if (idx === 0) return { transferFromPrev: false };
  const prev = legs[idx - 1];
  if (prev.mode !== "SUBWAY") return { transferFromPrev: false };
  const p = prev as { to?: Station | null; line?: string };
  const transfer =
    Boolean(p.to && leg.from && (p.to.name ?? "").trim() === (leg.from.name ?? "").trim());
  return { prevLine: typeof p.line === "string" ? p.line : "", transferFromPrev: transfer };
}

export default function Transit1Fields({
  legs,
  setLegs,
  openStationSearch,
  openBusStopSearch,
  requestConfirm
}: {
  legs: Array<
    | {
        mode: "BUS";
        start: string;
        end: string;
        busNumber: string;
        from: string;
        to: string;
        amount: string;
      }
    | {
        mode: "SUBWAY";
        start: string;
        end: string;
        from: Station | null;
        to: Station | null;
        line: string;
        amount: string;
      }
  >;
  setLegs: React.Dispatch<
    React.SetStateAction<
      Array<
        | {
            mode: "BUS";
            start: string;
            end: string;
            busNumber: string;
            from: string;
            to: string;
            amount: string;
          }
        | {
            mode: "SUBWAY";
            start: string;
            end: string;
            from: Station | null;
            to: Station | null;
            line: string;
            amount: string;
          }
      >
    >
  >;

  openStationSearch: (_legIndex: number, _field: "from" | "to") => void;
  openBusStopSearch: (_legIndex: number, _field: "from" | "to") => void;

  requestConfirm: (_message: string, _action: () => void | Promise<void>) => void;
}) {
  const fieldOptional = cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass());
  const fieldRequired = cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass({ required: true }));

  useLayoutEffect(() => {
    setLegs((arr) => {
      let changed = false;
      const next = arr.map((leg, idx) => {
        if (leg.mode !== "SUBWAY") return leg;
        const sl = leg as SubwayLegSlice & {
          mode: "SUBWAY";
          start: string;
          end: string;
          amount: string;
        };
        const pool = subwayLinePool(sl.from, sl.to);
        const ctx = linePickContextForLeg(arr, idx, sl);
        const choices = orderSubwayLineChoices(pool, ctx);
        if (choices.length === 1 && sl.line !== choices[0]) {
          changed = true;
          return { ...leg, line: choices[0]! };
        }
        if (choices.length > 1 && sl.line && !choices.includes(sl.line)) {
          changed = true;
          return { ...leg, line: pickSubwayLineForPool(pool, ctx, "") };
        }
        if (choices.length > 1 && !sl.line.trim()) {
          changed = true;
          return { ...leg, line: pickSubwayLineForPool(pool, ctx, "") };
        }
        return leg;
      });
      return changed ? next : arr;
    });
  }, [legs, setLegs]);

  const legsTotalWon = useMemo(() => {
    let sum = 0;
    for (const leg of legs) {
      const v = parseAmountInput(String((leg as { amount?: string }).amount ?? ""));
      if (v != null) sum += v;
    }
    return sum;
  }, [legs]);

  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold text-slate-600">교통1 (대중교통)</div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">합계</div>
          <div className="text-sm font-bold tabular-nums text-indigo-700">
            {legsTotalWon > 0 ? formatWon(legsTotalWon) : "—"}
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {legs.map((leg, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white px-3 pb-3 pt-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-500">
                {idx === 0 ? "구간" : `환승 ${idx}`}
              </div>
              {idx > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-slate-500 transition-colors hover:text-indigo-600"
                  aria-label="구간 삭제"
                  onClick={() => {
                    requestConfirm("이 구간이 삭제됩니다. 삭제하시겠습니까?", () =>
                      setLegs((arr) => arr.filter((_, i) => i !== idx))
                    );
                  }}
                >
                  <CloseXIcon className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              {[
                { label: "버스", mode: "BUS" as const, emoji: "🚌" },
                { label: "지하철", mode: "SUBWAY" as const, emoji: "🚃" }
              ].map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors",
                    leg.mode === opt.mode
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm hover:bg-indigo-600"
                      : "border-slate-200 bg-white text-slate-800 hover:bg-white hover:text-indigo-600"
                  )}
                  onClick={() => {
                    setLegs((arr) => {
                      const next = [...arr];
                      const current = next[idx] as { mode?: string; start?: string; end?: string; amount?: string };
                      if (current?.mode === opt.mode) return next;
                      const carryAmount = String(current?.amount ?? "");
                      next[idx] =
                        opt.mode === "BUS"
                          ? {
                              mode: "BUS",
                              start: String(current.start ?? ""),
                              end: String(current.end ?? ""),
                              busNumber: "",
                              from: "",
                              to: "",
                              amount: carryAmount
                            }
                          : {
                              mode: "SUBWAY",
                              start: String(current.start ?? ""),
                              end: String(current.end ?? ""),
                              from: null,
                              to: null,
                              line: "",
                              amount: carryAmount
                            };
                      return next;
                    });
                  }}
                >
                  <span className="text-base leading-none">{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="min-w-0">
                <div className="mb-1 text-xs text-slate-400">출발시간</div>
                <input
                  value={leg.start}
                  onChange={(e) =>
                    setLegs((arr) => {
                      const next = [...arr];
                      next[idx] = { ...(next[idx] as any), start: normalizeFourDigitTimeInput(e.target.value) };
                      return next;
                    })
                  }
                  placeholder="예: 09:00"
                  className={fieldOptional}
                />
              </label>
              <label className="min-w-0">
                <div className="mb-1 text-xs text-slate-400">도착시간</div>
                <input
                  value={leg.end}
                  onChange={(e) =>
                    setLegs((arr) => {
                      const next = [...arr];
                      next[idx] = { ...(next[idx] as any), end: normalizeFourDigitTimeInput(e.target.value) };
                      return next;
                    })
                  }
                  placeholder="예: 09:30"
                  className={fieldOptional}
                />
              </label>
            </div>

            {leg.mode === "BUS" ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <p className="col-span-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                  버스는 <span className="font-semibold text-slate-700">노선·승하차 위치</span>를 직접 적거나,{" "}
                  <span className="font-semibold text-slate-700">국토부 TAGO 공공 API</span>로 도시·노선을 고른 뒤 정류장을
                  고를 수 있어요. (서버에 인증키 필요)
                </p>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-400">버스번호</div>
                  <input
                    value={(leg as any).busNumber}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), busNumber: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 500, M412"
                    className={fieldOptional}
                  />
                </label>
                <label className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>출발(승차)</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700"
                      onClick={() => openBusStopSearch(idx, "from")}
                    >
                      API로 찾기
                    </button>
                  </div>
                  <input
                    value={(leg as any).from}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), from: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: ○○정류장, 집 근처 정류장"
                    className={fieldOptional}
                  />
                </label>
                <label className="min-w-0">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>도착(하차)</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700"
                      onClick={() => openBusStopSearch(idx, "to")}
                    >
                      API로 찾기
                    </button>
                  </div>
                  <input
                    value={(leg as any).to}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), to: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: △△정류장, 회사 앞"
                    className={fieldOptional}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">출발역</div>
                  <button
                    type="button"
                    className={cn(fieldOptional, "text-left font-semibold text-slate-900")}
                    onClick={() => openStationSearch(idx, "from")}
                  >
                    {(leg as any).from?.name ?? "선택"}
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">도착역</div>
                  <button
                    type="button"
                    className={cn(fieldOptional, "text-left font-semibold text-slate-900")}
                    onClick={() => openStationSearch(idx, "to")}
                  >
                    {(leg as any).to?.name ?? "선택"}
                  </button>
                </div>
                {(() => {
                  const sl = leg as SubwayLegSlice & {
                    mode: "SUBWAY";
                    start: string;
                    end: string;
                    amount: string;
                  };
                  const pool = subwayLinePool(sl.from, sl.to);
                  const ctx = linePickContextForLeg(legs, idx, sl);
                  const choices = orderSubwayLineChoices(pool, ctx);
                  const lineLabel = idx === 0 ? "호선" : "환승 호선";
                  if (choices.length > 1) {
                    return (
                      <label className="col-span-2">
                        <div className="mb-1 text-xs text-slate-400">{lineLabel}</div>
                        <select
                          value={choices.includes(sl.line) ? sl.line : (choices[0] ?? "")}
                          onChange={(e) =>
                            setLegs((arr) => {
                              const next = [...arr];
                              next[idx] = { ...(next[idx] as any), line: e.target.value };
                              return next;
                            })
                          }
                          className={cn(NATIVE_SELECT_CHEVRON_CLASS, "w-full")}
                          style={NATIVE_SELECT_CHEVRON_STYLE}
                        >
                          {choices.map((ln) => (
                            <option key={ln} value={ln}>
                              {ln}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  if (choices.length === 1) {
                    return (
                      <div className="col-span-2">
                        <div className="mb-1 text-xs text-slate-400">{lineLabel}</div>
                        <div className={cn(fieldOptional, "text-slate-700")}>{choices[0]}</div>
                      </div>
                    );
                  }
                  return (
                    <label className="col-span-2">
                      <div className="mb-1 text-xs text-slate-400">{lineLabel}</div>
                      <input
                        value={sl.line}
                        onChange={(e) =>
                          setLegs((arr) => {
                            const next = [...arr];
                            next[idx] = { ...(next[idx] as any), line: e.target.value };
                            return next;
                          })
                        }
                        placeholder="예: 2호선"
                        className={fieldOptional}
                      />
                    </label>
                  );
                })()}
              </div>
            )}

            <label className="mt-2 block">
              <div className="mb-1 text-xs text-slate-400">금액(필수)</div>
              <input
                inputMode="numeric"
                value={String((leg as { amount?: string }).amount ?? "")}
                onChange={(e) =>
                  setLegs((arr) => {
                    const next = [...arr];
                    next[idx] = {
                      ...(next[idx] as object),
                      amount: formatAmountInputWithCommas(e.target.value)
                    } as (typeof legs)[number];
                    return next;
                  })
                }
                placeholder="예: 1,500"
                className={fieldRequired}
              />
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
        onClick={() =>
          setLegs((arr) => [...arr, emptyTransit1Leg()])
        }
      >
        + 환승 추가
      </button>
    </div>
  );
}
