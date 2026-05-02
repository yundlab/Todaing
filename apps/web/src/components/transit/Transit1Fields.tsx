import { useLayoutEffect } from "react";
import { cn } from "../cn";
import type { Station } from "../../features/transit/stations";
import { normalizeFourDigitTimeInput } from "../../domain/time";

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

function subwayLineChoices(leg: SubwayLegSlice): string[] {
  const from = leg.from?.lines ?? [];
  const to = leg.to?.lines ?? [];
  if (!from.length && !to.length) return [];
  if (!from.length) return [...to].sort((a, b) => a.localeCompare(b, "ko"));
  if (!to.length) return [...from].sort((a, b) => a.localeCompare(b, "ko"));
  const inter = from.filter((l) => to.includes(l));
  const raw = inter.length > 0 ? inter : [...new Set([...from, ...to])];
  return [...raw].sort((a, b) => a.localeCompare(b, "ko"));
}

export default function Transit1Fields({
  legs,
  setLegs,
  openStationSearch,
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
      }
    | {
        mode: "SUBWAY";
        start: string;
        end: string;
        from: Station | null;
        to: Station | null;
        line: string;
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
          }
        | {
            mode: "SUBWAY";
            start: string;
            end: string;
            from: Station | null;
            to: Station | null;
            line: string;
          }
      >
    >
  >;

  openStationSearch: (_legIndex: number, _field: "from" | "to") => void;

  requestConfirm: (_message: string, _action: () => void | Promise<void>) => void;
}) {
  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-slate-400";

  useLayoutEffect(() => {
    setLegs((arr) => {
      let changed = false;
      const next = arr.map((leg) => {
        if (leg.mode !== "SUBWAY") return leg;
        const sl = leg as SubwayLegSlice & { mode: "SUBWAY"; start: string; end: string };
        const choices = subwayLineChoices(sl);
        if (choices.length === 1 && sl.line !== choices[0]) {
          changed = true;
          return { ...sl, line: choices[0]! };
        }
        if (choices.length > 1 && sl.line && !choices.includes(sl.line)) {
          changed = true;
          return { ...sl, line: choices[0]! };
        }
        if (choices.length > 1 && !sl.line.trim()) {
          changed = true;
          return { ...sl, line: choices[0]! };
        }
        return leg;
      });
      return changed ? next : arr;
    });
  }, [legs, setLegs]);

  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통1 (대중교통)</div>
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
                      const current = next[idx] as any;
                      if (current?.mode === opt.mode) return next;
                      next[idx] =
                        opt.mode === "BUS"
                          ? {
                              mode: "BUS",
                              start: current.start,
                              end: current.end,
                              busNumber: "",
                              from: "",
                              to: ""
                            }
                          : {
                              mode: "SUBWAY",
                              start: current.start,
                              end: current.end,
                              from: null,
                              to: null,
                              line: ""
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
                  className={fieldClass}
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
                  className={fieldClass}
                />
              </label>
            </div>

            {leg.mode === "BUS" ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
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
                    placeholder="예: 500"
                    className={fieldClass}
                  />
                </label>
                <label className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">출발</div>
                  <input
                    value={(leg as any).from}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), from: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 집앞"
                    className={fieldClass}
                  />
                </label>
                <label className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">도착</div>
                  <input
                    value={(leg as any).to}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), to: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 회사앞"
                    className={fieldClass}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">출발역</div>
                  <button
                    type="button"
                    className={cn(fieldClass, "text-left font-semibold text-slate-900")}
                    onClick={() => openStationSearch(idx, "from")}
                  >
                    {(leg as any).from?.name ?? "선택"}
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-xs text-slate-400">도착역</div>
                  <button
                    type="button"
                    className={cn(fieldClass, "text-left font-semibold text-slate-900")}
                    onClick={() => openStationSearch(idx, "to")}
                  >
                    {(leg as any).to?.name ?? "선택"}
                  </button>
                </div>
                {(() => {
                  const sl = leg as SubwayLegSlice & { mode: "SUBWAY" };
                  const choices = subwayLineChoices(sl);
                  if (choices.length > 1) {
                    return (
                      <label className="col-span-2">
                        <div className="mb-1 text-xs text-slate-400">호선</div>
                        <select
                          value={choices.includes(sl.line) ? sl.line : (choices[0] ?? "")}
                          onChange={(e) =>
                            setLegs((arr) => {
                              const next = [...arr];
                              next[idx] = { ...(next[idx] as any), line: e.target.value };
                              return next;
                            })
                          }
                          className={cn(fieldClass, "cursor-pointer")}
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
                        <div className="mb-1 text-xs text-slate-400">호선</div>
                        <div className={cn(fieldClass, "text-slate-700")}>{choices[0]}</div>
                      </div>
                    );
                  }
                  return (
                    <label className="col-span-2">
                      <div className="mb-1 text-xs text-slate-400">호선(선택)</div>
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
                        className={fieldClass}
                      />
                    </label>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
        onClick={() =>
          setLegs((arr) => [
            ...arr,
            { mode: "SUBWAY", start: "", end: "", from: null, to: null, line: "" }
          ])
        }
      >
        + 환승 추가
      </button>
    </div>
  );
}
