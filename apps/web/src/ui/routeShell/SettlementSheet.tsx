import { cn } from "@/components/cn";
import { formatWon } from "@/domain/settlement";
import { computeSettlementToday } from "@/domain/routeShellSettlement";

type SettlementToday = ReturnType<typeof computeSettlementToday>;

export default function SettlementSheet(props: {
  open: boolean;
  dayKey: string;
  settlementToday: SettlementToday;
  onClose: () => void;
}) {
  const { open, dayKey, settlementToday, onClose } = props;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[75]">
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="닫기" type="button" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">정산표</div>
            <div className="mt-1 text-xs text-slate-500">
              {dayKey} · {settlementToday.me} 기준
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            onClick={onClose}
          >
            닫기
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {Array.from(settlementToday.perPerson.entries())
            .filter(([, amt]) => Math.abs(amt) >= 1)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .map(([name, amt]) => {
              const isReceive = amt >= 0;
              return (
                <div
                  key={name}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border p-3",
                    isReceive ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                  )}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    <span
                      className={cn("mr-2 rounded-full px-2 py-0.5 text-xs text-white", isReceive ? "bg-emerald-600" : "bg-rose-600")}
                    >
                      {isReceive ? name : "나"}
                    </span>
                    <span className="mx-1 text-slate-400">→</span>
                    <span
                      className={cn("rounded-full px-2 py-0.5 text-xs text-white", isReceive ? "bg-slate-900" : "bg-indigo-600")}
                    >
                      {isReceive ? "나" : name}
                    </span>
                  </div>
                  <div className={cn("text-sm font-semibold tabular-nums", isReceive ? "text-emerald-700" : "text-rose-700")}>
                    {formatWon(Math.round(Math.abs(amt)))}
                  </div>
                </div>
              );
            })}
          {!settlementToday.perPerson.size ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">오늘 정산 항목이 없어요.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
