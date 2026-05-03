import type { CSSProperties } from "react";
import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";

/**
 * 네이티브 <select> 기본 화살표 제거 + 카테고리 드롭다운과 동일한 slate-400 chevron.
 * 인라인 appearance는 iOS/WebKit에서 클래스만으로 남는 기본 화살표를 막는 데 도움이 됨.
 */
export const NATIVE_SELECT_CHEVRON_STYLE: CSSProperties = {
  WebkitAppearance: "none",
  appearance: "none",
  MozAppearance: "none",
  colorScheme: "light",
  backgroundColor: "#ffffff",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.875rem center",
  backgroundSize: "1.125rem 1.125rem"
};

const NATIVE_SELECT_CHEVRON_BASE =
  "min-w-0 cursor-pointer appearance-none rounded-xl bg-white py-3 pl-3 pr-12 text-sm text-slate-900";

export const NATIVE_SELECT_CHEVRON_CLASS = cn(NATIVE_SELECT_CHEVRON_BASE, fieldBorderClass());

export const NATIVE_SELECT_CHEVRON_CLASS_REQUIRED = cn(NATIVE_SELECT_CHEVRON_BASE, fieldBorderClass({ required: true }));
