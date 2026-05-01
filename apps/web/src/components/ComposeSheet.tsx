import type { ReactNode } from "react";

export default function ComposeSheet(props: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/60" onClick={props.onClose} aria-label="닫기" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-screen-sm max-h-[90dvh] flex-col rounded-t-3xl border border-slate-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{props.title}</div>
            {props.subtitle ? (
              <div className="mt-1 text-xs text-slate-400">{props.subtitle}</div>
            ) : null}
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
            onClick={props.onClose}
          >
            닫기
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto overscroll-contain">{props.children}</div>

        {props.footer ? <div className="mt-3">{props.footer}</div> : null}
      </div>
    </div>
  );
}

