import type { IconProps } from "./iconProps";

/** 현금 */
export function CashIcon({ className }: IconProps) {
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
      <path d="M10 8h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10" />
      <path d="M6 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2" />
      <circle cx="14" cy="14" r="2" />
    </svg>
  );
}
