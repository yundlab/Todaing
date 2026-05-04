import { useEffect, useMemo, useState } from "react";
import { loadCapitalMetroStations, searchStationsCached, type Station } from "@/features/transit/stations";
import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";

/** 승차에서 이미 고른 TAGO/서울 노선으로 하차만 고를 때 `route-stops`에 그대로 넘깁니다. */
export type BusApiRouteReuse = {
  cityCode: string;
  routeId: string;
  transitProvider: "tago" | "seoul";
  routeNo: string;
};

export type StationSearchTarget = {
  legIndex: number;
  field: "from" | "to";
  busReuse?: BusApiRouteReuse;
};

type Props = {
  open: StationSearchTarget | null;
  query: string;
   
  onQueryChange: (q: string) => void;
  onClose: () => void;
  /** 사용자가 역을 선택했을 때 — legIndex/field와 함께 station 전달 */
   
  onPick: (target: StationSearchTarget, station: Station) => void;
};

export default function StationSearchSheet({ open, query, onQueryChange, onClose, onPick }: Props) {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    loadCapitalMetroStations()
      .then((list) => {
        if (!cancelled) setStations(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!stations) return [];
    return searchStationsCached(query, stations);
  }, [stations, query]);

  if (!open) return null;
  const title = open.field === "from" ? "출발 선택" : "도착 선택";

  return (
    <div className="fixed inset-0 z-[60]">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-4rem)] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs text-slate-500">역 이름 검색</div>
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="예: 서울역"
          className={cn("mt-3 w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
        />

        <ul className="mt-3 space-y-2 pb-2">
          {loadError ? (
            <li className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              역 목록을 불러오지 못했어요. {loadError}
            </li>
          ) : stations == null ? (
            <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              역 정보를 불러오는 중…
            </li>
          ) : (
            results.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:brightness-[0.99]"
                  onClick={() => onPick(open, s)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-slate-600">{s.lines.join(" · ")}</div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
        </div>
      </div>
    </div>
  );
}
