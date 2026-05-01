import { forwardRef, type ComponentPropsWithoutRef } from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

/** date / datetime-local 공통: 네이티브 달력 아이콘은 숨기고 CalendarIcon 오버레이 사용 */
export const calendarPickerIndicatorOverlayClasses =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-[0.875rem] [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:bottom-0 [&::-webkit-calendar-picker-indicator]:z-[1] [&::-webkit-calendar-picker-indicator]:m-auto [&::-webkit-calendar-picker-indicator]:h-9 [&::-webkit-calendar-picker-indicator]:w-9 [&::-webkit-calendar-picker-indicator]:max-h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 " +
  "[&::-moz-calendar-picker-indicator]:absolute [&::-moz-calendar-picker-indicator]:right-[0.875rem] [&::-moz-calendar-picker-indicator]:top-0 [&::-moz-calendar-picker-indicator]:bottom-0 [&::-moz-calendar-picker-indicator]:z-[1] [&::-moz-calendar-picker-indicator]:m-auto [&::-moz-calendar-picker-indicator]:h-9 [&::-moz-calendar-picker-indicator]:w-9 [&::-moz-calendar-picker-indicator]:max-h-full [&::-moz-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:opacity-0";

const DateMonthInput = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function DateMonthInput({ className, ...props }, ref) {
    return (
      <div className="relative min-w-0">
        <input
          ref={ref}
          {...props}
          className={cn(
            "box-border w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-12 align-middle leading-normal outline-none focus:border-slate-400",
            calendarPickerIndicatorOverlayClasses,
            className
          )}
        />
        <span className="pointer-events-none absolute bottom-0 right-[0.875rem] top-0 z-0 flex items-center">
          <CalendarIcon className="h-[1.125rem] w-[1.125rem] shrink-0 text-slate-400" />
        </span>
      </div>
    );
  }
);

export default DateMonthInput;
