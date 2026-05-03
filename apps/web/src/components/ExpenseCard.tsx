import type { ReactNode } from "react";

export default function ExpenseCard(props: {
  onClick: () => void;
  leftIcon: ReactNode;
  title: ReactNode;
  chips?: ReactNode;
  meta?: ReactNode;
  quote?: ReactNode;
  amount: ReactNode;
  /** 카드 맨 아래 전체 너비 한 줄 (예: 정산 일시·수단 + 정산 금액 뱃지) */
  settlement?: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full cursor-pointer rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:brightness-[0.99]"
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          {props.leftIcon}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="min-w-0 break-words text-base font-semibold leading-snug text-slate-900">
                {props.title}
              </div>
              {props.chips}
            </div>
            {props.meta ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-400">
                {props.meta}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">{props.amount}</div>
      </div>
      {props.quote ? <div className="mt-2 w-full min-w-0">{props.quote}</div> : null}
      {props.settlement ? (
        <div className="mt-2 flex w-full min-w-0 items-center justify-between gap-2">{props.settlement}</div>
      ) : null}
    </div>
  );
}
