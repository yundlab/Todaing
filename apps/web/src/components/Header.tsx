import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import TodaingLogoMark from "./TodaingLogoMark";

export default function Header(props: {
  dayKey: string;
  monthKey: string;
  monthMode: boolean;
  calendarInputRef: RefObject<HTMLInputElement>;
   
  onPick: (_next: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  rightSlot?: ReactNode;
}) {
  const {
    dayKey,
    monthKey,
    monthMode,
    calendarInputRef,
    onPick,
    onPrev,
    onNext,
    rightSlot
  } = props;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-md px-4 py-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 justify-start">
            <Link
              to="/"
              className="inline-flex shrink-0 active:scale-[0.99]"
              aria-label="투데잉 홈"
              title="투데잉"
            >
              <TodaingLogoMark size="sm" />
            </Link>
          </div>

          <div className="flex shrink-0 items-center justify-center gap-1">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-[0.99]"
              onClick={onPrev}
              aria-label={monthMode ? "이전 달" : "이전 날짜"}
              title="이전"
              type="button"
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
            {/* 탭 한 번에 네이티브 date/month 피커 — 메인에서도 안정적으로 열기 */}
            <div className="relative inline-flex">
              <button
                type="button"
                className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-900 shadow-sm active:scale-[0.99]"
                onClick={() => {
                  const el = calendarInputRef.current;
                  if (!el) return;
                  // Safari/모바일에서 opacity=0 input 클릭이 막히는 케이스가 있어 showPicker 우선 사용
                  const anyEl = el as any;
                  if (typeof anyEl.showPicker === "function") anyEl.showPicker();
                  else el.click();
                }}
                aria-label={monthMode ? "월 선택" : "날짜 선택"}
              >
                {monthMode ? monthKey : dayKey}
              </button>
              <input
                ref={calendarInputRef}
                type={monthMode ? "month" : "date"}
                value={monthMode ? monthKey : dayKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const d = monthMode ? new Date(`${v}-01T00:00:00`) : new Date(`${v}T00:00:00`);
                  if (Number.isNaN(d.getTime())) return;
                  d.setHours(0, 0, 0, 0);
                  onPick(d);
                }}
                className="sr-only"
                tabIndex={-1}
              />
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-[0.99]"
              onClick={onNext}
              aria-label={monthMode ? "다음 달" : "다음 날짜"}
              title="다음"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M9 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-end gap-1">
            {rightSlot}
          </div>
        </div>
      </div>
    </header>
  );
}
