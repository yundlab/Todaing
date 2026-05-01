/** @deprecated 월별 키로 이전한 뒤, 값이 있으면 월별 맵에 없는 달의 폴백으로만 사용 */
export const MONTHLY_BUDGET_LS_KEY = "monthlyBudgetWon";

export const MONTHLY_BUDGET_BY_YM_LS_KEY = "monthlyBudgetWonByYm";

export const DEFAULT_MONTHLY_BUDGET_WON = 10_000_000;

export function parseStoredMonthlyBudgetWon(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_MONTHLY_BUDGET_WON;
}

/** 기존 단일 예산 키. 없거나 잘못된 값이면 null */
export function readLegacyMonthlyBudgetWonFromStorage(): number | null {
  try {
    const raw = window.localStorage.getItem(MONTHLY_BUDGET_LS_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  } catch {
    return null;
  }
}

const ymKeyRe = /^\d{4}-\d{2}$/;

export function parseMonthlyBudgetByYm(raw: string): Record<string, number> {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(v)) {
      if (!ymKeyRe.test(k)) continue;
      const n = typeof val === "number" ? val : Number(val);
      if (Number.isFinite(n) && n > 0) out[k] = Math.round(n);
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeMonthlyBudgetByYm(map: Record<string, number>): string {
  return JSON.stringify(map);
}

/**
 * 해당 월에 저장된 예산이 있으면 사용하고,
 * 없으면 예전 단일 키(legacy) 값, 그것도 없으면 기본값.
 */
export function effectiveMonthlyBudgetWon(
  ym: string,
  byYm: Record<string, number>,
  legacyFallback: number | null
): number {
  const own = byYm[ym];
  if (typeof own === "number" && Number.isFinite(own) && own > 0) return own;
  if (legacyFallback != null && legacyFallback > 0) return legacyFallback;
  return DEFAULT_MONTHLY_BUDGET_WON;
}
