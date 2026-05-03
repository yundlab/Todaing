import { useCallback, useEffect, useMemo, useState } from "react";
import type { StationSearchTarget } from "@/components/StationSearchSheet";
import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";
import { HttpError } from "@/lib/http";
import {
  fetchTagoCityCodes,
  fetchTagoRouteStops,
  searchTagoRoutes,
  searchTagoRoutesBroad,
  type TagoBusStop,
  type TagoCity,
  type TagoRouteSummary
} from "@/features/transit/tagoTransitClient";

/** 「서울시」·「서」 한 글자 등으로도 `서울특별시` 등이 걸리게 검색어를 확장 */
function cityFilterNeedles(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const needles = new Set<string>([q]);
  if (q.length >= 2) {
    if (q.endsWith("시")) needles.add(q.slice(0, -1));
    if (q.endsWith("군")) needles.add(q.slice(0, -1));
    if (q.endsWith("구")) needles.add(q.slice(0, -1));
  }
  const metro = (full: string, short: string) => {
    if (q === full || q === short) needles.add(short);
  };
  metro("서울시", "서울");
  metro("부산시", "부산");
  metro("대구시", "대구");
  metro("인천시", "인천");
  metro("광주시", "광주");
  metro("대전시", "대전");
  metro("울산시", "울산");
  metro("세종시", "세종");
  if (q === "제주시" || q === "제주") needles.add("제주");

  /** 한 글자·짧은 접두 → 광역 통칭(부분 문자열) 추가 — `서`만 쳐도 `서울`로 넓혀 매칭 */
  const shortMetro: [RegExp, string][] = [
    [/^(서|서울)$/, "서울"],
    [/^(부|부산)$/, "부산"],
    [/^(대구)$/, "대구"],
    [/^(인|인천)$/, "인천"],
    [/^(광|광주)$/, "광주"],
    [/^(대전)$/, "대전"],
    [/^(울|울산)$/, "울산"],
    [/^(세|세종)$/, "세종"],
    [/^(제|제주)$/, "제주"]
  ];
  for (const [re, word] of shortMetro) {
    if (re.test(q)) needles.add(word);
  }

  return [...needles];
}

/** 짧은 검색일 때 서울·광역시가 목록 맨 위에 오도록 */
function cityFilterSortRank(cityName: string, filterRaw: string): number {
  const n = cityName.toLowerCase();
  const q = filterRaw.trim().toLowerCase();
  if (!q) return 50;
  const boosts: [RegExp, (_name: string) => boolean][] = [
    [/^(서|서울|서울시)/, (name) => name.includes("서울")],
    [/^(부|부산|부산시)/, (name) => name.includes("부산")],
    [/^(대구|대구시)/, (name) => name.includes("대구")],
    [/^(인|인천|인천시)/, (name) => name.includes("인천")],
    [/^(광|광주|광주시)/, (name) => name.includes("광주")],
    [/^(대전|대전시)/, (name) => name.includes("대전")],
    [/^(울|울산|울산시)/, (name) => name.includes("울산")],
    [/^(세|세종|세종시)/, (name) => name.includes("세종")],
    [/^(제|제주|제주시)/, (name) => name.includes("제주")]
  ];
  for (const [re, pred] of boosts) {
    if (re.test(q) && pred(n)) return 0;
  }
  if (n.startsWith(q)) return 1;
  return 2;
}

type Step = "routes" | "stops";

type Props = {
  open: StationSearchTarget | null;
  onClose: () => void;
  onPick: (_target: StationSearchTarget, _stopLabel: string) => void;
};

export default function BusStopSearchSheet({ open, onClose, onPick }: Props) {
  const [step, setStep] = useState<Step>("routes");
  const [cities, setCities] = useState<TagoCity[] | null>(null);
  const [cityCode, setCityCode] = useState("");
  const [routeNoInput, setRouteNoInput] = useState("");
  const [routes, setRoutes] = useState<TagoRouteSummary[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<TagoRouteSummary | null>(null);
  const [stops, setStops] = useState<TagoBusStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 도시 목록 필터 (선택값과 별도 — 입력 중 덮어쓰기 방지) */
  const [cityFilter, setCityFilter] = useState("");
  const [broadSearchPending, setBroadSearchPending] = useState(false);

  const resetForOpen = useCallback(() => {
    setStep("routes");
    setCities(null);
    setCityCode("");
    setCityFilter("");
    setRouteNoInput("");
    setRoutes([]);
    setSelectedRoute(null);
    setStops([]);
    setError(null);
    setLoading(false);
    setBroadSearchPending(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetForOpen();
  }, [open, resetForOpen]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (cities !== null) return;
      setLoading(true);
      setError(null);
      try {
        const list = await fetchTagoCityCodes();
        if (cancelled) return;
        setCities(list);
        /** 도시는 매번 목록에서만 고릅니다(localStorage 복원 없음 — 새로고침 후에도 이전 시·군이 남지 않게). */
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e instanceof HttpError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e);
        setError(msg);
        setCities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, cities]);

  const title = useMemo(() => {
    if (!open) return "";
    return open.field === "from" ? "승차 정류장 (공공 API)" : "하차 정류장 (공공 API)";
  }, [open]);

  const filteredCities = useMemo(() => {
    if (!cities?.length) return [];
    const needles = cityFilterNeedles(cityFilter);
    if (!needles.length) return cities;
    const filtered = cities.filter((c) => {
      const n = c.cityName.toLowerCase();
      const cc = c.cityCode.toLowerCase();
      return needles.some((needle) => n.includes(needle) || cc.includes(needle));
    });
    const q = cityFilter.trim();
    if (!q) return filtered;
    return [...filtered].sort((a, b) => {
      const ra = cityFilterSortRank(a.cityName, q);
      const rb = cityFilterSortRank(b.cityName, q);
      if (ra !== rb) return ra - rb;
      return a.cityName.localeCompare(b.cityName, "ko");
    });
  }, [cities, cityFilter]);

  const selectedCityLabel = useMemo(() => {
    if (!cities?.length || !cityCode.trim()) return null;
    return cities.find((c) => c.cityCode === cityCode.trim())?.cityName ?? null;
  }, [cities, cityCode]);

  const pickCity = (c: TagoCity) => {
    setCityCode(c.cityCode);
    setCityFilter("");
  };

  const searchRoutes = async () => {
    if (!open) return;
    if (cities === null) {
      setError("도시 목록을 불러오는 중이에요. 잠시 후 다시 검색해 주세요.");
      return;
    }
    if (!cities.length) {
      setError("도시 목록을 불러오지 못했어요. API 서버와 인증키 설정을 확인한 뒤 다시 열어 주세요.");
      return;
    }
    const cc = cityCode.trim();
    const rn = routeNoInput.trim();
    if (!cc) {
      setError("도시를 선택해 주세요.");
      return;
    }
    if (!rn) {
      setError("노선 번호를 입력해 주세요.");
      return;
    }
    setBroadSearchPending(false);
    setLoading(true);
    setError(null);
    setRoutes([]);
    setSelectedRoute(null);
    setStops([]);
    setStep("routes");
    try {
      const list = await searchTagoRoutes(cc, rn);
      setRoutes(list);
      if (!list.length) {
        setError(
          "검색된 노선이 없어요. 도시를 바꿔 보거나, 아래 「번호만 넓게 찾기」로 여러 지역을 한꺼번에 찾아 보세요.",
        );
      }
    } catch (e: unknown) {
      const msg =
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const searchRoutesBroad = async () => {
    if (!open) return;
    const rn = routeNoInput.trim();
    if (!rn) {
      setError("노선 번호를 입력해 주세요.");
      return;
    }
    setBroadSearchPending(true);
    setLoading(true);
    setError(null);
    setRoutes([]);
    setSelectedRoute(null);
    setStops([]);
    setStep("routes");
    try {
      const list = await searchTagoRoutesBroad(rn);
      setRoutes(list);
      if (!list.length) {
        setError("여러 지역에서 찾아도 노선이 없어요. 번호를 바꿔 보거나, 도시를 직접 골라 다시 검색해 보세요.");
      }
    } catch (e: unknown) {
      const msg =
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
    } finally {
      setLoading(false);
      setBroadSearchPending(false);
    }
  };

  const openRouteStops = async (r: TagoRouteSummary) => {
    const cc = (r.cityCode ?? cityCode).trim();
    if (!cc || !r.routeId) return;
    /** 노선만 고른 경우(넓게 찾기 등)는 화면상 도시만 맞추고, 저장소에는 쓰지 않습니다. */
    if (r.cityCode) setCityCode(r.cityCode);
    setLoading(true);
    setError(null);
    setSelectedRoute(r);
    try {
      const list = await fetchTagoRouteStops(cc, r.routeId, {
        transitProvider: r.transitProvider ?? "tago"
      });
      setStops(list);
      setStep("stops");
      if (!list.length) setError("이 노선에 정류장 정보가 없어요.");
    } catch (e: unknown) {
      const msg =
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
      setSelectedRoute(null);
    } finally {
      setLoading(false);
    }
  };

  const pickStop = (s: TagoBusStop) => {
    if (!open || !selectedRoute) return;
    const no = selectedRoute.routeNo.trim();
    const label =
      s.nodeNo && s.nodeNm
        ? `${s.nodeNm} (${no}번 · 정류장번호 ${s.nodeNo})`
        : s.nodeNm
          ? `${s.nodeNm} (${no}번)`
          : `${no}번 노선`;
    onPick(open, label);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-4rem)] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {step === "routes"
                  ? "시·군·구(도시)와 노선 번호로 검색한 뒤, 노선·정류장을 고릅니다."
                  : `${selectedRoute?.routeNo ?? ""}번 경유 정류장`}
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
              onClick={onClose}
            >
              닫기
            </button>
          </div>

          {step === "stops" ? (
            <div className="mt-3">
              <button
                type="button"
                className="mb-3 text-xs font-semibold text-indigo-600"
                onClick={() => {
                  setStep("routes");
                  setStops([]);
                  setSelectedRoute(null);
                }}
              >
                ← 노선 다시 선택
              </button>
              <ul className="space-y-2">
                {stops.map((s) => (
                  <li key={`${s.nodeId || s.seq}-${s.seq}`}>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:brightness-[0.99]"
                      onClick={() => pickStop(s)}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-400 tabular-nums">{s.seq}</span>
                        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{s.nodeNm || "—"}</span>
                        {s.nodeNo ? (
                          <span className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums">
                            {s.nodeNo}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="block">
                <div className="mb-1 text-xs text-slate-400">도시</div>
                {cities === null ? (
                  <div className={cn("rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500", fieldBorderClass())}>
                    도시 목록을 불러오는 중…
                  </div>
                ) : !cities.length ? (
                  <div className={cn("rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500", fieldBorderClass())}>
                    도시 목록을 불러오지 못했어요
                  </div>
                ) : (
                  <>
                    <input
                      type="search"
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (filteredCities.length === 1) pickCity(filteredCities[0]!);
                      }}
                      disabled={loading}
                      placeholder="이름 검색 (예: 서울시, 서울특별시, 수원, 가평)"
                      autoComplete="off"
                      className={cn("w-full rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                    />
                    {selectedCityLabel ? (
                      <div className="mt-1.5 text-xs text-slate-600">
                        선택됨 · <span className="font-semibold text-slate-800">{selectedCityLabel}</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 text-xs text-amber-800/90">아래 목록에서 행정구역을 한 번 눌러 선택해 주세요.</div>
                    )}
                    {!cityFilter.trim() && cities.length > 80 ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        목록이 많습니다. 검색어를 입력하면 빠르게 좁힐 수 있어요.
                      </div>
                    ) : null}
                    <ul
                      className={cn(
                        "mt-2 max-h-52 space-y-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1",
                        fieldBorderClass(),
                      )}
                      role="listbox"
                      aria-label="도시 목록"
                    >
                      {filteredCities.length === 0 ? (
                        <li className="px-3 py-3 text-center text-sm text-slate-500">검색 결과가 없어요.</li>
                      ) : (
                        filteredCities.map((c) => {
                          const active = cityCode.trim() === c.cityCode;
                          return (
                            <li key={c.cityCode}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                disabled={loading}
                                onClick={() => pickCity(c)}
                                className={cn(
                                  "w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                  active
                                    ? "bg-indigo-50 font-semibold text-indigo-900"
                                    : "text-slate-800 hover:bg-slate-50",
                                  loading && "pointer-events-none opacity-60",
                                )}
                              >
                                {c.cityName}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={routeNoInput}
                    onChange={(e) => setRouteNoInput(e.target.value)}
                    placeholder="노선 번호 (예: 146, M412, 9401)"
                    className={cn("min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-sm", fieldBorderClass())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void searchRoutes();
                    }}
                  />
                  <button
                    type="button"
                    disabled={loading || cities === null || !cities.length}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    onClick={() => void searchRoutes()}
                  >
                    검색
                  </button>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  className={cn(
                    "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm",
                    loading && "opacity-50",
                  )}
                  onClick={() => void searchRoutesBroad()}
                >
                  번호만 넓게 찾기
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                    도시 지정 없이, 시·군·구 여러 곳을 순서대로 조회합니다.
                  </span>
                </button>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  {error}
                </div>
              ) : null}

              {loading && step === "routes" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {broadSearchPending
                    ? "여러 지역에서 노선을 찾는 중이에요…(잠시만 기다려 주세요)"
                    : "불러오는 중…"}
                </div>
              ) : null}

              <ul className="space-y-2">
                {routes.map((r) => (
                  <li key={`${r.cityCode ?? ""}-${r.routeId}`}>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:brightness-[0.99]"
                      onClick={() => void openRouteStops(r)}
                      disabled={loading}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-indigo-700 tabular-nums">{r.routeNo}</span>
                        {r.routeType ? (
                          <span className="text-[11px] font-medium text-slate-500">{r.routeType}</span>
                        ) : null}
                      </div>
                      {r.cityName ? (
                        <div className="mt-0.5 text-[11px] font-medium text-indigo-600/90">{r.cityName}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-slate-600">
                        {r.startNode || "?"} → {r.endNode || "?"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
