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
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:m-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 " +
  "[&::-moz-calendar-picker-indicator]:absolute [&::-moz-calendar-picker-indicator]:inset-0 [&::-moz-calendar-picker-indicator]:m-0 [&::-moz-calendar-picker-indicator]:h-full [&::-moz-calendar-picker-indicator]:w-full [&::-moz-calendar-picker-indicator]:cursor-pointer [&::-moz-calendar-picker-indicator]:opacity-0";

type DateMonthInputProps = ComponentPropsWithoutRef<"input"> & {
  iconAlign?: "right" | "center";
};

const DateMonthInput = forwardRef<HTMLInputElement, DateMonthInputProps>(
  function DateMonthInput({ className, iconAlign = "right", ...props }, ref) {
    const isCenter = iconAlign === "center";
    return (
      <div className="relative min-w-0">
        <input
          ref={ref}
          {...props}
          className={cn(
            "box-border w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3 align-middle leading-normal outline-none focus:border-slate-400",
            isCenter ? "px-3 text-center" : "pl-3 pr-12",
            calendarPickerIndicatorOverlayClasses,
            className
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute z-0 flex items-center",
            isCenter ? "inset-0 justify-center" : "bottom-0 right-[0.875rem] top-0"
          )}
        >
          <CalendarIcon className="h-[1.125rem] w-[1.125rem] shrink-0 text-slate-400" />
        </span>
      </div>
    );
  }
);

export default DateMonthInput;
