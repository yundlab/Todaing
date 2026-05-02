import type { ReactNode } from "react";

export default function ComposeSheet(props: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode | null;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60" onClick={props.onClose} aria-label="닫기" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 justify-center pt-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3 pt-1">
          <div>
            <div className="text-sm font-semibold">{props.title}</div>
            {props.subtitle ? (
              <div className="mt-1 text-xs font-semibold text-slate-400">{props.subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-transparent text-slate-500 transition-colors hover:bg-transparent hover:text-indigo-600 active:scale-[0.99]"
            onClick={props.onClose}
            aria-label="닫기"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{props.children}</div>

        {props.footer ? (
          <div className="shrink-0 border-t border-slate-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
