import { cn } from "../cn";
import type { Station } from "../../features/transit/stations";
import { normalizeFourDigitTimeInput } from "../../domain/time";

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
  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통1 (대중교통)</div>
      <div className="mt-3 space-y-2">
        {legs.map((leg, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500">
                {idx === 0 ? "구간" : `환승 ${idx}`}
              </div>
              {idx > 0 ? (
                <button
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  onClick={() => {
                    requestConfirm("이 구간이 삭제됩니다. 삭제하시겠습니까?", () =>
                      setLegs((arr) => arr.filter((_, i) => i !== idx))
                    );
                  }}
                >
                  삭제
                </button>
              ) : null}
            </div>

            <div className="mt-2 flex gap-2">
              {[
                { label: "버스", mode: "BUS" as const, emoji: "🚌" },
                { label: "지하철", mode: "SUBWAY" as const, emoji: "🚈" }
              ].map((opt) => (
                <button
                  key={opt.mode}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm",
                    leg.mode === opt.mode
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-800"
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
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                <div className="mb-1 text-xs text-slate-500">출발시간</div>
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착시간</div>
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            {leg.mode === "BUS" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-500">버스번호</div>
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-500">출발</div>
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
                <label>
                  <div className="mb-1 text-xs text-slate-500">도착</div>
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900"
                  onClick={() => openStationSearch(idx, "from")}
                >
                  출발역: {(leg as any).from?.name ?? "선택"}
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900"
                  onClick={() => openStationSearch(idx, "to")}
                >
                  도착역: {(leg as any).to?.name ?? "선택"}
                </button>
                <label className="col-span-2">
                  <div className="mb-1 text-xs text-slate-500">호선(선택)</div>
                  <input
                    value={(leg as any).line}
                    onChange={(e) =>
                      setLegs((arr) => {
                        const next = [...arr];
                        next[idx] = { ...(next[idx] as any), line: e.target.value };
                        return next;
                      })
                    }
                    placeholder="예: 2호선"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
        onClick={() =>
          setLegs((arr) => [
            ...arr,
            { mode: "SUBWAY", start: arr[arr.length - 1]?.end ?? "09:30", end: "10:00", from: null, to: null, line: "" }
          ])
        }
      >
        + 환승 추가
      </button>
    </div>
  );
}
