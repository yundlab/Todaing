import { normalizeCategory } from "@/domain/categoryUi";

export type CategoryTint = { bg: string; border: string; text: string };

const GROUP_TINT: Record<"fixed" | "food" | "optionalFixed" | "living" | "other", CategoryTint> = {
  fixed: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-900" },
  food: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-900" },
  optionalFixed: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900" },
  living: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900" },
  other: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-900" }
};

const CATEGORY_TINT_OVERRIDE: Record<string, CategoryTint> = {
  생활: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  병원: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  선물: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  여행: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-900" },
  god: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900" },
  PPTNZ: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900" },
  안재현: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  덕질: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  영화: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  뮤지컬: { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" },
  "공연/전시": { bg: "bg-slate-900", border: "border-slate-900", text: "text-white" }
};

function groupForCategory(category: string) {
  if (["교통1", "교통2", "통신", "보험"].includes(category)) return "fixed";
  if (["식사", "간식"].includes(category)) return "food";
  if (["담배", "구독"].includes(category)) return "optionalFixed";
  if (["생활", "여행", "병원", "선물"].includes(category)) return "living";
  return "other";
}

export function tintForCategory(category: string): CategoryTint {
  const c = normalizeCategory(category);
  return CATEGORY_TINT_OVERRIDE[c] ?? GROUP_TINT[groupForCategory(c)];
}
