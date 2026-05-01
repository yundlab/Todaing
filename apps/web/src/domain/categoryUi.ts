const CATEGORY_ALIAS: Record<string, string> = {
  OTT: "구독"
};

export function normalizeCategory(raw: string) {
  const c = raw.trim();
  return CATEGORY_ALIAS[c] ?? c;
}

const CATEGORY_EMOJI: Record<string, string> = {
  교통1: "🚌",
  교통2: "🚆",
  통신: "📱",
  보험: "🛡️",
  식비: "🍚",
  간식: "🥤",
  담배: "🪄",
  구독: "💸",
  생활: "🛍️",
  병원: "🩺",
  선물: "🎁",
  god: "🩵",
  PPTNZ: "💚",
  안재현: "🤍",
  덕질: "❣️",
  영화: "🎬",
  뮤지컬: "💎",
  "공연/전시": "✨",
  기타: "📍"
};

const EMOJI_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_EMOJI).map(([k, v]) => [v, k])
) as Record<string, string>;

export const CATEGORY_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: "필수 고정비", items: ["교통1", "교통2", "통신", "보험"] },
  { label: "식음료", items: ["식비", "간식"] },
  { label: "선택 고정비", items: ["담배", "구독"] },
  { label: "생활", items: ["생활", "병원", "선물"] },
  { label: "덕질", items: ["god", "PPTNZ", "안재현", "덕질"] },
  { label: "문화", items: ["영화", "뮤지컬", "공연/전시"] },
  { label: "기타", items: ["기타"] }
];

export const ALL_CATEGORIES = Array.from(new Set(CATEGORY_GROUPS.flatMap((g) => g.items)));

export function emojiForCategory(raw: string) {
  const c = normalizeCategory(raw);
  return CATEGORY_EMOJI[c] ?? "🧾";
}

export function parseEmojiPrefixedTitle(rawTitle: string) {
  const t = rawTitle.trim();
  const firstSpace = t.indexOf(" ");
  if (firstSpace <= 0) return { category: "기타", content: t };
  const prefix = t.slice(0, firstSpace).trim();
  const rest = t.slice(firstSpace + 1).trim();
  const cat = EMOJI_TO_CATEGORY[prefix];
  if (cat) return { category: cat, content: rest };
  return { category: "기타", content: t };
}

export const GROUP_LABEL_STYLE: Record<
  string,
  { dotBg: string; boxBorder: string; boxBg: string; headerText: string }
> = {
  "필수 고정비": {
    dotBg: "bg-rose-300",
    boxBorder: "border-rose-200",
    boxBg: "bg-rose-50/40",
    headerText: "text-rose-900"
  },
  식음료: {
    dotBg: "bg-orange-300",
    boxBorder: "border-orange-200",
    boxBg: "bg-orange-50/40",
    headerText: "text-orange-900"
  },
  "선택 고정비": {
    dotBg: "bg-amber-300",
    boxBorder: "border-amber-200",
    boxBg: "bg-amber-50/40",
    headerText: "text-amber-900"
  },
  생활: {
    dotBg: "bg-emerald-300",
    boxBorder: "border-emerald-200",
    boxBg: "bg-emerald-50/40",
    headerText: "text-emerald-900"
  },
  덕질: {
    dotBg: "bg-indigo-300",
    boxBorder: "border-indigo-200",
    boxBg: "bg-indigo-50/40",
    headerText: "text-indigo-900"
  },
  문화: {
    dotBg: "bg-sky-300",
    boxBorder: "border-sky-200",
    boxBg: "bg-sky-50/40",
    headerText: "text-sky-900"
  },
  기타: {
    dotBg: "bg-slate-300",
    boxBorder: "border-slate-200",
    boxBg: "bg-slate-50/40",
    headerText: "text-slate-900"
  }
};
