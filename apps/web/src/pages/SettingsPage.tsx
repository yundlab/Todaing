import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { yyyyMmLocal } from "../domain/date";
import {
  effectiveMonthlyBudgetWon,
  MONTHLY_BUDGET_BY_YM_LS_KEY,
  parseMonthlyBudgetByYm,
  readLegacyMonthlyBudgetWonFromStorage,
  serializeMonthlyBudgetByYm
} from "../domain/monthlyBudgetStorage";
import { parseAmountInput } from "../domain/parseAmountInput";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { AUTH_USER_LS_KEY } from "../lib/auth";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [hasAuth] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem(AUTH_USER_LS_KEY));
    } catch {
      return false;
    }
  });

  const [legacyBudgetFallback] = useState(() => readLegacyMonthlyBudgetWonFromStorage());
  const [budgetByYm, setBudgetByYm] = useLocalStorageState<Record<string, number>>(
    MONTHLY_BUDGET_BY_YM_LS_KEY,
    {},
    {
      parse: parseMonthlyBudgetByYm,
      serialize: serializeMonthlyBudgetByYm
    }
  );

  const [editMonthYm, setEditMonthYm] = useState(() => yyyyMmLocal(new Date()));
  const monthlyBudgetWon = useMemo(
    () => effectiveMonthlyBudgetWon(editMonthYm, budgetByYm, legacyBudgetFallback),
    [editMonthYm, budgetByYm, legacyBudgetFallback]
  );

  const [budgetDraft, setBudgetDraft] = useState(() =>
    effectiveMonthlyBudgetWon(
      yyyyMmLocal(new Date()),
      budgetByYm,
      legacyBudgetFallback
    ).toLocaleString("ko-KR")
  );

  useEffect(() => {
    setBudgetDraft(
      effectiveMonthlyBudgetWon(editMonthYm, budgetByYm, legacyBudgetFallback).toLocaleString("ko-KR")
    );
  }, [editMonthYm]);

  const budgetHint = useMemo(
    () => `현재 금액 ${monthlyBudgetWon.toLocaleString()}원 · 월별로 기기에 저장됩니다(LocalStorage)`,
    [monthlyBudgetWon]
  );

  const applyBudgetDraft = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const parsed = parseAmountInput(raw);
    if (parsed === null) return;
    setBudgetByYm((prev) => ({ ...prev, [editMonthYm]: parsed }));
    setBudgetDraft(parsed.toLocaleString("ko-KR"));
  };

  const logout = () => {
    try {
      window.localStorage.removeItem(AUTH_USER_LS_KEY);
    } catch {
      void 0;
    }
    navigate("/", { replace: true });
  };

  if (!hasAuth) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:scale-[0.99]"
            aria-label="뒤로"
            onClick={() => navigate(-1)}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">설정</div>
            <div className="text-xs text-slate-500">예산 · 계정</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">월별 예산</div>
            <div className="mt-2 text-xs text-slate-500">{budgetHint}</div>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">수정할 달 (YYYY-MM)</div>
              <input
                type="month"
                value={editMonthYm}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setEditMonthYm(v);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-base font-semibold tabular-nums text-slate-900 outline-none focus:border-indigo-400"
              />
            </div>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">{editMonthYm}</span> 월 예산(원)
              </div>
              <input
                inputMode="numeric"
                value={budgetDraft}
                onChange={(e) => {
                  const raw = e.target.value;
                  setBudgetDraft(raw);
                  applyBudgetDraft(raw);
                }}
                onBlur={() => {
                  const t = budgetDraft.trim();
                  if (!t) {
                    setBudgetDraft(
                      effectiveMonthlyBudgetWon(
                        editMonthYm,
                        budgetByYm,
                        legacyBudgetFallback
                      ).toLocaleString("ko-KR")
                    );
                    return;
                  }
                  const parsed = parseAmountInput(budgetDraft);
                  if (parsed === null) {
                    setBudgetDraft(
                      effectiveMonthlyBudgetWon(
                        editMonthYm,
                        budgetByYm,
                        legacyBudgetFallback
                      ).toLocaleString("ko-KR")
                    );
                    return;
                  }
                  setBudgetByYm((prev) => ({ ...prev, [editMonthYm]: parsed }));
                  setBudgetDraft(parsed.toLocaleString("ko-KR"));
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-right font-mono text-base font-semibold tabular-nums tracking-tight text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
            <p className="mt-3 text-xs text-slate-500">
              입력 즉시 저장되며, 지난달·다른 달 화면의 예산은 그대로 둡니다. 메인 예산 카드는 선택한 달 기준으로
              반영됩니다.
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_12px_30px_-20px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">계정</div>
            <div className="mt-1 text-xs text-slate-500">이 기기에 저장된 로그인 정보를 지웁니다.</div>
          </div>
          <div className="p-5">
            <button
              type="button"
              className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 active:scale-[0.99]"
              onClick={logout}
            >
              로그아웃
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
