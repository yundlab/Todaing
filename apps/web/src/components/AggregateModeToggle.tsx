import { cn } from "./cn";
import type { AggregateMode } from "../domain/installment";

export default function AggregateModeToggle({
  mode,
  onChange,
  size = "sm"
}: {
  mode: AggregateMode;
  onChange: (_next: AggregateMode) => void;
  size?: "sm" | "xs";
}) {
  const padding = size === "xs" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5"
      role="tablist"
      aria-label="합계 기준"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "usage"}
        className={cn(
          "rounded-full font-semibold tabular-nums tracking-tight transition",
          padding,
          text,
          mode === "usage" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
        onClick={() => onChange("usage")}
      >
        사용액
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "cashflow"}
        className={cn(
          "rounded-full font-semibold tabular-nums tracking-tight transition",
          padding,
          text,
          mode === "cashflow" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
        )}
        onClick={() => onChange("cashflow")}
      >
        실출금
      </button>
    </div>
  );
}
