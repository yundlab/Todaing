export default function ConfirmDialog(props: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { message, onCancel, onConfirm } = props;
  return (
    <div className="fixed inset-0 z-[95]">
      <button className="absolute inset-0 bg-black/60" onClick={onCancel} aria-label="닫기" type="button" />
      <div className="absolute inset-x-0 top-1/2 mx-auto w-full max-w-md -translate-y-1/2 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="text-sm font-semibold text-slate-900">삭제 확인</div>
          <div className="mt-2 text-sm text-slate-700">{message}</div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm"
              onClick={onCancel}
            >
              취소
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 shadow-sm"
              onClick={async () => {
                await onConfirm();
              }}
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
