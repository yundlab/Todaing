import type { IconProps } from "./iconProps";

/** 결제자 구분용 */
export function WalletIcon({ className }: IconProps) {
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
      <path d="M20 12V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
      <path d="M16 12h4a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-4" />
      <circle cx="16.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
