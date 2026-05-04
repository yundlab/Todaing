import type { IconProps } from "./iconProps";

/** 계좌·이체 */
export function BankIcon({ className }: IconProps) {
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
      <path d="M3 10h18" />
      <path d="M5 10V8a7 7 0 0 1 14 0v2" />
      <path d="M4 10v10h16V10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}
