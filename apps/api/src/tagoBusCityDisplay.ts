/**
 * 국토부 TAGO `getCtyCodeList` 원시 `cityname`·`citycode`를 UI·정렬용으로 다듬습니다.
 * (원시 데이터는 "서울", "서울시" 등 짧은 표기인 경우가 많음)
 */

const CODE_TO_LABEL: Record<string, string> = {
  "11": "서울특별시",
  "12": "세종특별자치시",
  "21": "부산광역시",
  "22": "대구광역시",
  "23": "인천광역시",
  "24": "광주광역시",
  "25": "대전광역시",
  "26": "울산광역시",
  "39": "제주특별자치도"
};

export function tagoBusCityDisplayName(cityCode: string, rawName: string): string {
  const code = cityCode.trim();
  const name = rawName.trim();
  const byCode = CODE_TO_LABEL[code];
  /** TAGO는 `cityname`이 비어 있는 행이 있어도 `citycode`만으로 광역을 식별할 수 있습니다. */
  if (!name) return byCode ?? name;
  if (byCode) return byCode;
  if (name === "서울" || name === "서울시") return "서울특별시";
  if (name === "세종" || name === "세종시") return "세종특별자치시";
  if (name === "부산" || name === "부산시") return "부산광역시";
  if (name === "대구" || name === "대구시") return "대구광역시";
  if (name === "인천" || name === "인천시") return "인천광역시";
  if (name === "광주" || name === "광주시") return "광주광역시";
  if (name === "대전" || name === "대전시") return "대전광역시";
  if (name === "울산" || name === "울산시") return "울산광역시";
  if (name === "제주" || name === "제주시" || name === "제주도") return "제주특별자치도";
  return name;
}

/** 낮을수록 목록 상단(서울·광역시·그 외 가나다) */
function tagoBusCitySortRank(displayName: string): number {
  if (displayName.startsWith("서울특별")) return 0;
  if (/(광역시|특별자치시|특별자치도)$/.test(displayName)) return 1;
  return 2;
}

/** TAGO 목록에 빠지는 광역·특별시행정구역을 `citycode`로 보강할 때 사용(정렬 순서 고정) */
const TAGO_METRO_FALLBACK_ORDER: Array<{ cityCode: string; cityName: string }> = [
  { cityCode: "11", cityName: "서울특별시" },
  { cityCode: "12", cityName: "세종특별자치시" },
  { cityCode: "21", cityName: "부산광역시" },
  { cityCode: "22", cityName: "대구광역시" },
  { cityCode: "23", cityName: "인천광역시" },
  { cityCode: "24", cityName: "광주광역시" },
  { cityCode: "25", cityName: "대전광역시" },
  { cityCode: "26", cityName: "울산광역시" },
  { cityCode: "39", cityName: "제주특별자치도" }
];

/** API가 일부 광역 행을 누락하거나(빈 이름·다른 키) 페이지 밖에 있을 때 최소 보장 */
export function mergeTagoMetroFallback(cities: Array<{ cityCode: string; cityName: string }>): Array<{
  cityCode: string;
  cityName: string;
}> {
  const byCode = new Map(cities.map((c) => [c.cityCode.trim(), c]));
  for (const m of TAGO_METRO_FALLBACK_ORDER) {
    if (!byCode.has(m.cityCode)) byCode.set(m.cityCode, { ...m });
  }
  const merged = [...byCode.values()];
  merged.sort((a, b) => {
    const ra = tagoBusCitySortRank(a.cityName);
    const rb = tagoBusCitySortRank(b.cityName);
    if (ra !== rb) return ra - rb;
    return a.cityName.localeCompare(b.cityName, "ko");
  });
  return merged;
}
