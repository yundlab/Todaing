/**
 * 수도권 전철 역 목록 생성 (검색용).
 * 원본: https://github.com/chanyou/open-seoul-subway/blob/master/station_code.csv
 * 노선명은 external_code·내부코드 규칙으로 추론(일부 광역·국철은 넓게 묶음).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_URL =
  "https://raw.githubusercontent.com/chanyou/open-seoul-subway/master/station_code.csv";
const OUT = join(__dirname, "../apps/web/src/features/transit/stations.generated.ts");

function lineForRow(extRaw, _metroRaw) {
  const ext = String(extRaw).trim();
  const c = ext.charAt(0);
  if (c === "A" || c === "a") return "공항철도";
  if (c === "D" || c === "d") return "신분당선";
  if (c === "Y") return "용인경전철";
  if (c === "U") return "의정부경전철";
  if (c === "P") return "수인·분당선";
  if (c === "I") return "인천2호선";
  if (c === "K" || c === "k") {
    const km = ext.match(/^K(\d+)/i);
    const kn = km ? parseInt(km[1], 10) : 0;
    // open-seoul-subway: K2xx 대부분 분당·수인, K31x 서울~일산 경의, K11x~K13x 경의·경춘 등
    if (kn >= 210 && kn <= 249) return "분당선";
    if (kn >= 250 && kn <= 264) return "수인선";
    if (kn >= 310 && kn <= 329) return "경의·중앙선";
    if (kn >= 110 && kn <= 118) return "경의·중앙선";
    if (kn >= 119 && kn <= 138) return "경춘선";
    if (kn >= 800 && kn <= 830) return "경의·중앙선";
    return "경의·중앙·경춘";
  }

  const numMatch = ext.match(/^(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 100 && n <= 199) return "1호선";
    if (n >= 200 && n <= 299) return "2호선";
    if (n >= 300 && n <= 399) return "3호선";
    if (n >= 400 && n <= 499) return "4호선";
    if (n >= 500 && n <= 599) return "5호선";
    if (n >= 600 && n <= 699) return "6호선";
    if (n >= 700 && n <= 799) return "7호선";
    if (n >= 800 && n <= 899) return "8호선";
    if (n >= 900 && n <= 999) return "9호선";
  }
  return "기타";
}

function parseCsvLine(line) {
  const parts = line.split(",");
  if (parts.length < 4) return null;
  const name = parts[3]?.trim();
  if (!name) return null;
  return {
    seoulmetro: parts[1]?.trim() ?? "",
    external: parts[2]?.trim() ?? "",
    name
  };
}

const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
const text = await res.text();
const lines = text.split(/\r?\n/).filter(Boolean);
const byName = new Map();

for (let i = 1; i < lines.length; i++) {
  const row = parseCsvLine(lines[i]);
  if (!row) continue;
  const line = lineForRow(row.external, row.seoulmetro);
  if (!byName.has(row.name)) byName.set(row.name, new Set());
  byName.get(row.name).add(line);
}

const stations = Array.from(byName.entries())
  .map(([name, set]) => ({
    name,
    lines: Array.from(set).sort((a, b) => a.localeCompare(b, "ko"))
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "ko"));

const header = `/**
 * 자동 생성 — scripts/build-capital-metro-stations.mjs
 * 원본 CSV: chanyou/open-seoul-subway (station_code.csv)
 * 갱신: repo 루트에서 \`node scripts/build-capital-metro-stations.mjs\`
 */
export type CapitalMetroStation = { name: string; lines: string[] };

export const CAPITAL_AREA_STATIONS: CapitalMetroStation[] = `;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${header}${JSON.stringify(stations, null, 2)};\n`, "utf8");
console.log(`Wrote ${stations.length} stations → ${OUT}`);
