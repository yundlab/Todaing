import type { IconProps } from "./iconProps";

/** 버스(이동 표시) */
export function BusIcon({ className }: IconProps) {
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
      <path d="M8 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8" />
      <path d="M4 8H2v8h2" />
      <path d="M6 18h12" />
      <circle cx="8.5" cy="16.5" r="1.5" />
      <circle cx="17.5" cy="16.5" r="1.5" />
      <path d="M8 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
