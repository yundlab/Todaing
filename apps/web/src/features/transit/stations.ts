export type Station = {
  name: string;
  lines: string[]; // "1호선" ...
};

// MVP: 자주 쓰는 역 + 노선 (확장 가능)
export const STATIONS: Station[] = [
  { name: "서울역", lines: ["1호선", "4호선"] },
  { name: "시청", lines: ["1호선", "2호선"] },
  { name: "종각", lines: ["1호선"] },
  { name: "종로3가", lines: ["1호선", "3호선", "5호선"] },
  { name: "동대문", lines: ["1호선", "4호선"] },
  { name: "신도림", lines: ["1호선", "2호선"] },
  { name: "영등포", lines: ["1호선"] },
  { name: "구로", lines: ["1호선"] },
  { name: "홍대입구", lines: ["2호선"] },
  { name: "합정", lines: ["2호선", "6호선"] },
  { name: "강남", lines: ["2호선"] },
  { name: "역삼", lines: ["2호선"] },
  { name: "잠실", lines: ["2호선", "8호선"] },
  { name: "건대입구", lines: ["2호선", "7호선"] },
  { name: "고속터미널", lines: ["3호선", "7호선", "9호선"] },
  { name: "교대", lines: ["2호선", "3호선"] },
  { name: "양재", lines: ["3호선"] },
  { name: "경복궁", lines: ["3호선"] },
  { name: "압구정", lines: ["3호선"] },
  { name: "여의도", lines: ["5호선", "9호선"] },
  { name: "여의나루", lines: ["5호선"] },
  { name: "광화문", lines: ["5호선"] },
  { name: "마포", lines: ["5호선"] },
  { name: "공덕", lines: ["5호선", "6호선"] },
  { name: "이태원", lines: ["6호선"] },
  { name: "삼각지", lines: ["4호선", "6호선"] },
  { name: "사당", lines: ["2호선", "4호선"] },
  { name: "혜화", lines: ["4호선"] },
  { name: "명동", lines: ["4호선"] },
  { name: "성수", lines: ["2호선"] },
  { name: "왕십리", lines: ["2호선", "5호선"] }
];

export function searchStations(query: string, limit = 12): Station[] {
  const q = query.trim();
  if (!q) return STATIONS.slice(0, limit);
  const lower = q.toLowerCase();
  return STATIONS.filter((s) => s.name.toLowerCase().includes(lower)).slice(0, limit);
}

