import { BankIcon } from "./BankIcon";
import { CashIcon } from "./CashIcon";
import { CreditCardIcon } from "./CreditCardIcon";
import { MoneyIcon } from "./MoneyIcon";

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
