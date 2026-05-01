import { Link } from "react-router-dom";
import TodaingLogoMark from "./TodaingLogoMark";

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.8 1.8 0 0 0 .36 2l.04.05a2.2 2.2 0 0 1-1.56 3.76 2.2 2.2 0 0 1-1.56-.65l-.05-.04a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21a2.2 2.2 0 0 1-4.4 0v-.06a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.04a2.2 2.2 0 0 1-3.11 0 2.2 2.2 0 0 1 0-3.11l.04-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.1H3a2.2 2.2 0 0 1 0-4.4h.06a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.36-2l-.04-.05a2.2 2.2 0 0 1 0-3.11 2.2 2.2 0 0 1 3.11 0l.05.04a1.8 1.8 0 0 0 2 .36 1.8 1.8 0 0 0 1.1-1.65V3a2.2 2.2 0 0 1 4.4 0v.06a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.05-.04a2.2 2.2 0 0 1 3.11 0 2.2 2.2 0 0 1 0 3.11l-.04.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H21a2.2 2.2 0 0 1 0 4.4h-.06a1.8 1.8 0 0 0-1.65 1.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header(props: {
  dayKey: string;
  monthKey: string;
  monthMode: boolean;
  calendarPopoverOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  setCalendarPopoverOpen: (_next: boolean | ((_prev: boolean) => boolean)) => void;
  calendarInputRef: React.RefObject<HTMLInputElement>;
  // eslint-disable-next-line no-unused-vars
  onPick: (_next: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  /** 오늘/월 상세일 때 홈으로 닫기 버튼 표시 */
  showDetailClose?: boolean;
  onDetailClose?: () => void;
}) {
  const {
    dayKey,
    monthKey,
    monthMode,
    calendarPopoverOpen,
    setCalendarPopoverOpen,
    calendarInputRef,
    onPick,
    onPrev,
    onNext,
    showDetailClose,
    onDetailClose
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
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold tabular-nums text-slate-900 shadow-sm active:scale-[0.99]"
              onClick={() => setCalendarPopoverOpen((v) => !v)}
              aria-label={monthMode ? "월 선택" : "날짜 선택"}
              title={monthMode ? "월 선택" : "날짜 선택"}
            >
              {monthMode ? monthKey : dayKey}
            </button>
            {calendarPopoverOpen ? (
              <div className="fixed inset-0 z-[80]">
                <button
                  type="button"
                  className="absolute inset-0"
                  onClick={() => setCalendarPopoverOpen(false)}
                  aria-label="닫기"
                />
                <div className="absolute left-1/2 top-[72px] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">
                      {monthMode ? "월 선택" : "날짜 선택"}
                    </div>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                      onClick={() => setCalendarPopoverOpen(false)}
                    >
                      닫기
                    </button>
                  </div>
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
                      setCalendarPopoverOpen(false);
                    }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-slate-400"
                  />
                </div>
              </div>
            ) : null}
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
            <Link
              to="/settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-[0.99]"
              aria-label="설정"
              title="설정"
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
            {showDetailClose ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 active:scale-[0.99]"
                onClick={onDetailClose}
                aria-label="닫기"
                title="닫기"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
