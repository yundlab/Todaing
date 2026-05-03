import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";

const INSTALLMENT_MONTH_OPTIONS = Array.from({ length: 35 }, (_, i) => i + 2);

export default function CardInstallmentFields(props: {
  installment: boolean;
  setInstallment: (_v: boolean) => void;
  months: number;
  setMonths: (_n: number) => void;
  noInterest: boolean;
  setNoInterest: (_v: boolean) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-xs text-slate-400">카드 할부(필수)</div>
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
            !props.installment
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-800"
          )}
          onClick={() => {
            props.setInstallment(false);
            props.setNoInterest(false);
          }}
        >
          일시불
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-xl border px-3 py-3 text-sm font-semibold shadow-sm",
            props.installment
              ? "border-indigo-600 bg-indigo-600 text-white"
              : "border-slate-200 bg-white text-slate-800"
          )}
          onClick={() => props.setInstallment(true)}
        >
          할부
        </button>
      </div>
      {props.installment ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="min-w-[8rem] flex-1">
            <div className="mb-1 text-xs text-slate-400">할부 개월(필수)</div>
            <div className="relative min-w-0">
              <select
                value={props.months}
                onChange={(e) => props.setMonths(Number(e.target.value))}
                className={cn(
                  "w-full min-w-0 cursor-pointer appearance-none rounded-xl bg-white px-3 py-3 pr-10 text-sm font-semibold",
                  fieldBorderClass({ required: true })
                )}
              >
                {INSTALLMENT_MONTH_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}개월
                  </option>
                ))}
              </select>
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </label>
          <button
            type="button"
            className="flex shrink-0 items-center gap-3 pb-3"
            onClick={() => props.setNoInterest(!props.noInterest)}
            aria-pressed={props.noInterest}
          >
            <span
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded border",
                props.noInterest
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-transparent"
              )}
              aria-hidden
            >
              ✓
            </span>
            <span className="text-sm font-semibold text-slate-900">무이자</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
