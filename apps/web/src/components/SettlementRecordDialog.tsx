import { CalendarIcon, calendarPickerIndicatorOverlayClasses } from "./DateMonthInput";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type SettlementLogOpen = {
  day: string;
  other: string;
  revertOnClose: boolean;
  /** 열 때점에 저장된 기록이 있으면 기록 삭제 버튼 표시 */
  hadRecordAtOpen?: boolean;
};

export default function SettlementRecordDialog(props: {
  open: SettlementLogOpen | null;
  paidAtLocal: string;
  method: string;
  note: string;
   
  onPaidAtLocalChange: (_v: string) => void;
   
  onMethodChange: (_v: string) => void;
   
  onNoteChange: (_v: string) => void;
  onCancel: () => void;
  onUnset?: () => void;
  /** 저장된 정산 기록만 제거 + (정산 완료면) 체크 해제 */
  onDeleteRecord?: () => void;
  onSave: () => void;
}) {
  const { open } = props;
  if (!open) return null;

  const showDelete = Boolean(open.hadRecordAtOpen && props.onDeleteRecord);

  return (
    <div className="fixed inset-0 z-[82]">
      <button className="absolute inset-0 bg-black/60" onClick={props.onCancel} aria-label="닫기" />
      <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-md -translate-y-1/2 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">정산 기록</div>
              <div className="mt-1 text-xs text-slate-400">
                {open.day} · {open.other}
              </div>
            </div>
            <button
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              onClick={props.onCancel}
            >
              닫기
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <div className="mb-1 text-xs text-slate-400">언제</div>
              <div className="relative min-w-0">
                <input
                  type="datetime-local"
                  value={props.paidAtLocal}
                  onChange={(e) => props.onPaidAtLocalChange(e.target.value)}
                  className={cn(
                    "box-border w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3 pl-3 pr-12 text-sm text-slate-900 outline-none focus:border-slate-400",
                    calendarPickerIndicatorOverlayClasses
                  )}
                />
                <span className="pointer-events-none absolute bottom-0 right-[0.875rem] top-0 z-0 flex items-center">
                  <CalendarIcon className="h-[1.125rem] w-[1.125rem] shrink-0 text-slate-400" />
                </span>
              </div>
            </label>

            <label className="block">
              <div className="mb-1 text-xs text-slate-400">수단</div>
              <input
                value={props.method}
                onChange={(e) => props.onMethodChange(e.target.value)}
                placeholder="예) 카뱅 / 토스 / 신한 / 현금"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-xs text-slate-400">메모(선택)</div>
              <input
                value={props.note}
                onChange={(e) => props.onNoteChange(e.target.value)}
                placeholder="예) 토스 / 카뱅 / 현금으로 줌"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={props.onCancel}
              >
                취소
              </button>
              <button
                className="flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 shadow-sm"
                onClick={props.onSave}
              >
                저장하고 정산완료
              </button>
            </div>
            {props.onUnset || showDelete ? (
              <div className="flex gap-2">
                {props.onUnset ? (
                  <button
                    className="flex-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm"
                    onClick={props.onUnset}
                    type="button"
                    title="정산 완료 체크 해제"
                  >
                    정산 해제
                  </button>
                ) : null}
                {showDelete ? (
                  <button
                    className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
                    onClick={props.onDeleteRecord}
                    type="button"
                    title="정산 메모·일시 기록 삭제"
                  >
                    기록 삭제
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
