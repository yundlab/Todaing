import { NavLink, useLocation, useMatch, useSearchParams } from "react-router-dom";
import { yyyyMmDdLocal, yyyyMmLocal } from "../domain/date";
import { cn } from "./cn";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 2v4M16 2v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}

function MonthIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 2v4M16 2v4M7 14h4M7 18h4M13 14h4M13 18h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19.4 15a1.8 1.8 0 0 0 .36 2l.04.05a2.2 2.2 0 0 1-1.56 3.76 2.2 2.2 0 0 1-1.56-.65l-.05-.04a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21a2.2 2.2 0 0 1-4.4 0v-.06a1.8 1.8 0 0 0-1.1-1.65 1.8 1.8 0 0 0-2 .36l-.05.04a2.2 2.2 0 0 1-3.11 0 2.2 2.2 0 0 1 0-3.11l.04-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.1H3a2.2 2.2 0 0 1 0-4.4h.06a1.8 1.8 0 0 0 1.65-1.1 1.8 1.8 0 0 0-.36-2l-.04-.05a2.2 2.2 0 0 1 0-3.11 2.2 2.2 0 0 1 3.11 0l.05.04a1.8 1.8 0 0 0 2 .36 1.8 1.8 0 0 0 1.1-1.65V3a2.2 2.2 0 0 1 4.4 0v.06a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.05-.04a2.2 2.2 0 0 1 3.11 0 2.2 2.2 0 0 1 0 3.11l-.04.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.1H21a2.2 2.2 0 0 1 0 4.4h-.06a1.8 1.8 0 0 0-1.65 1.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 메인·상세·설정 공통 하단 탭 (모바일 퍼스트, max-w-md 정렬) */
export default function BottomNav() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const todayMatch = useMatch("/today/:day");
  const monthMatch = useMatch("/month/:month");

  const mainDay = pathname === "/" ? searchParams.get("day") : null;

  let anchor = new Date();
  if (todayMatch?.params.day && /^\d{4}-\d{2}-\d{2}$/.test(todayMatch.params.day)) {
    anchor = new Date(`${todayMatch.params.day}T12:00:00`);
  } else if (monthMatch?.params.month && /^\d{4}-\d{2}$/.test(monthMatch.params.month)) {
    anchor = new Date(`${monthMatch.params.month}-15T12:00:00`);
  } else if (mainDay && /^\d{4}-\d{2}-\d{2}$/.test(mainDay)) {
    anchor = new Date(`${mainDay}T12:00:00`);
  }

  const todayHref = `/today/${yyyyMmDdLocal(anchor)}`;
  const monthHref = `/month/${yyyyMmLocal(anchor)}`;

  const itemClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors",
      active ? "text-indigo-600" : "text-slate-400"
    );
  const iconClass = (active: boolean) => cn("h-5 w-5 shrink-0", active ? "text-indigo-600" : "text-slate-400");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      aria-label="하단 메뉴"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pt-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <NavLink to="/" end className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <HomeIcon className={iconClass(isActive)} />
              홈
            </>
          )}
        </NavLink>
        <NavLink to={todayHref} className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <DayIcon className={iconClass(isActive)} />
              오늘
            </>
          )}
        </NavLink>
        <NavLink to={monthHref} className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <MonthIcon className={iconClass(isActive)} />
              이번 달
            </>
          )}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => itemClass(isActive)}>
          {({ isActive }) => (
            <>
              <GearIcon className={iconClass(isActive)} />
              설정
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}
