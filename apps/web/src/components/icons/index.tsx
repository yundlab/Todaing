type IconProps = { className?: string };

export function ClockIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="9" r="4" />
    </svg>
  );
}

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

/** 함께한 사람 구분용 */
export function UsersIcon({ className }: IconProps) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** 카드 결제 */
export function CreditCardIcon({ className }: IconProps) {
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
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

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

/** 지출 카드·상세 등 `paymentType` 표시용 */
export function PaymentMethodIcon({
  kind,
  className = "h-4 w-4 shrink-0 text-slate-300"
}: {
  kind: string;
  className?: string;
}) {
  switch (kind) {
    case "CARD":
      return <CreditCardIcon className={className} />;
    case "CASH":
      return <CashIcon className={className} />;
    case "ACCOUNT":
      return <BankIcon className={className} />;
    default:
      return <MoneyIcon className={className} />;
  }
}
