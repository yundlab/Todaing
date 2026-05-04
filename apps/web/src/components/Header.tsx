import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import TodaingLogoMark from "@/components/TodaingLogoMark";

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
              className="inline-flex shrink-0 transition-opacity hover:opacity-80 active:scale-[0.99]"
              aria-label="투데잉 홈"
              title="투데잉"
            >
              <TodaingLogoMark size="sm" />
            </Link>
          </div>

          <div className="flex shrink-0 items-center justify-center gap-1">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-transparent hover:text-indigo-600 active:scale-[0.99]"
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
            {/* 네이티브 date/month: iOS Safari는 sr-only+프로그램 click/showPicker가 막히는 경우가 많아, 실제 터치 타깃이 되는 투명 input 오버레이 사용 */}
            <div className="relative inline-flex min-h-8 min-w-[5.5rem] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-900 shadow-sm active:scale-[0.99]">
              <span className="pointer-events-none select-none" aria-hidden="true">
                {monthMode ? monthKey : dayKey}
              </span>
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
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-[0.01]"
                style={{ fontSize: "1rem" }}
                aria-label={monthMode ? "월 선택" : "날짜 선택"}
              />
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-transparent hover:text-indigo-600 active:scale-[0.99]"
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
