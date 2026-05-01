import type { Transit2SegmentDraft } from "../../domain/transitPayload";
import { yyyyMmDdLocal } from "../../domain/date";

export default function Transit2Fields({
  segments,
  setSegments
}: {
  segments: Transit2SegmentDraft[];
  setSegments: (_next: Transit2SegmentDraft[]) => void;
}) {
  return (
    <div className="col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-600">교통2 (기차/시외버스/택시/비행기)</div>
      <div className="mt-3 space-y-3">
        {segments.map((seg, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-600">구간 {idx + 1}</div>
              {segments.length > 1 ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-700"
                  onClick={() => setSegments(segments.filter((_, i) => i !== idx))}
                >
                  삭제
                </button>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="col-span-2">
                <div className="mb-1 text-xs text-slate-500">사용일</div>
                <input
                  type="date"
                  value={seg.dayKey}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, dayKey: v } : s)));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">출발시간</div>
                <input
                  value={seg.start}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)))
                  }
                  placeholder="예: 15:00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착시간</div>
                <input
                  value={seg.end}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)))
                  }
                  placeholder="선택"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">출발지</div>
                <input
                  value={seg.fromText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, fromText: e.target.value } : s)))
                  }
                  placeholder="예: 김포"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label>
                <div className="mb-1 text-xs text-slate-500">도착지</div>
                <input
                  value={seg.toText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, toText: e.target.value } : s)))
                  }
                  placeholder="예: 도쿄(하네다)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
              <label className="col-span-2">
                <div className="mb-1 text-xs text-slate-500">메모(선택)</div>
                <input
                  value={seg.memoText}
                  onChange={(e) =>
                    setSegments(segments.map((s, i) => (i === idx ? { ...s, memoText: e.target.value } : s)))
                  }
                  placeholder="예: 항공편 / 좌석 / 수하물"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="mt-2">
              <div className="mb-1 text-xs text-slate-500">수단</div>
              <div className="flex gap-2">
                {["🚆", "🚍", "🚖", "✈️"].map((m) => (
                  <button
                    type="button"
                    key={m}
                    className={`h-11 w-11 rounded-xl border text-xl ${
                      seg.mode === m
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                    onClick={() => setSegments(segments.map((s, i) => (i === idx ? { ...s, mode: m } : s)))}
                    aria-label={`교통수단 ${m}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
          onClick={() => {
            const baseDay = segments[segments.length - 1]?.dayKey ?? yyyyMmDdLocal(new Date());
            setSegments([
              ...segments,
              { dayKey: baseDay, start: "", end: "", fromText: "", toText: "", mode: "🚆", memoText: "" }
            ]);
          }}
        >
          + 구간 추가(출국/입국)
        </button>
      </div>
    </div>
  );
}
