type Props = {
  from: string;
  to: string;
  /** "내가 누군지" — from/to와 비교해 강조 표시 */
  me: string;
  /** 부호 포함 금액 (양수: 내가 받을 돈 / 음수: 내가 줄 돈) */
  amount: number;
  settled: boolean;
  onToggle: () => void;
};

const NAME_BADGE = "rounded-xl px-3 py-1 text-xs font-semibold";
const NAME_BADGE_ME = `${NAME_BADGE} bg-indigo-600 text-white`;
const NAME_BADGE_OTHER = `${NAME_BADGE} bg-slate-100 text-slate-700`;

function NameBadge({ name, isMe }: { name: string; isMe: boolean }) {
  return <span className={isMe ? NAME_BADGE_ME : NAME_BADGE_OTHER}>{name}</span>;
}

function CheckmarkCircle({ checked }: { checked: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
        checked
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-300 bg-white text-transparent"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3">
        <path
          d="M20 6L9 17l-5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function SettlementRow({ from, to, me, amount, settled, onToggle }: Props) {
  const sign = amount >= 0 ? "+" : "-";
  const abs = Math.round(Math.abs(amount));
  const amountTone = amount >= 0 ? "text-emerald-700" : "text-rose-700";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
        settled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <NameBadge name={from} isMe={from === me} />
        <span className="text-slate-400">→</span>
        <NameBadge name={to} isMe={to === me} />
      </div>
      <div className="flex items-center gap-4">
        <div
          className={`flex items-baseline gap-1 tabular-nums ${
            settled ? "text-slate-400" : amountTone
          }`}
        >
          <span className="text-base font-extrabold tracking-tight">
            {sign}
            {abs.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-400">원</span>
        </div>
        <CheckmarkCircle checked={settled} />
      </div>
    </button>
  );
}
