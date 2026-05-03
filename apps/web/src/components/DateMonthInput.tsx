import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/components/cn";
import { fieldBorderClass } from "@/components/inputFieldClasses";

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
  /** 라벨에 (필수)가 붙은 날짜/달 입력 — 기본 테두리만 진한 회색 */
  required?: boolean;
};

const DateMonthInput = forwardRef<HTMLInputElement, DateMonthInputProps>(
  function DateMonthInput({ className, iconAlign = "right", required: requiredField, ...props }, ref) {
    const isCenter = iconAlign === "center";
    return (
      <div className="group relative flex w-full min-w-0 max-w-full">
        <input
          ref={ref}
          {...props}
          className={cn(
            "box-border min-h-12 w-full min-w-0 flex-1 rounded-xl bg-white py-3 align-middle leading-normal transition-colors group-hover:border-indigo-300",
            fieldBorderClass({ required: requiredField }),
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
          <CalendarIcon className="h-[1.125rem] w-[1.125rem] shrink-0 text-slate-400 transition-colors group-hover:text-indigo-600" />
        </span>
      </div>
    );
  }
);

export default DateMonthInput;
