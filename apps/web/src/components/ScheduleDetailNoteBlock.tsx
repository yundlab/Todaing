import { cn } from "@/components/cn";
import { parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { parseScheduleNote } from "@/domain/scheduleNote";

export default function ScheduleDetailNoteBlock(props: {
  title: string;
  note: string | null;
  cancelled: boolean;
  onCancelledChange: (_next: boolean) => void;
}) {
  const parsedTitle = parseEmojiPrefixedTitle(props.title);
  const titleText = parsedTitle.content || props.title;
  const n = parseScheduleNote(props.note);
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-500">상태</div>
        <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            className={cn(
              "px-3 py-2 text-xs font-semibold",
              !props.cancelled ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
            )}
            onClick={() => props.onCancelledChange(false)}
          >
            일정
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-2 text-xs font-semibold",
              props.cancelled ? "bg-slate-600 text-white" : "bg-white text-slate-600"
            )}
            onClick={() => props.onCancelledChange(true)}
          >
            취소
          </button>
        </div>
      </div>
      <div>
        <div className="text-xs text-slate-400">제목</div>
        <div className={cn("mt-1 break-words font-semibold", props.cancelled ? "text-slate-400" : "text-slate-900")}>
          {titleText}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-xs text-slate-400">내용</div>
        <div className="mt-1 break-words text-slate-800">{n.memo?.trim() ? n.memo : "—"}</div>
      </div>
      <div className="mt-3">
        <div className="text-xs text-slate-400">세부 내용</div>
        <div className="mt-1 break-words text-slate-800">{n.detail?.trim() ? n.detail : "—"}</div>
      </div>
    </div>
  );
}
