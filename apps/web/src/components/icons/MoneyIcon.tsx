import type { IconProps } from "./iconProps";

export function MoneyIcon({ className }: IconProps) {
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
      <path d="M3 7h18v10H3z" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
