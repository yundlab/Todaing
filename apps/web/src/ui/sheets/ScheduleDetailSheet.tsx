import type { ReactNode } from "react";
import type { ScheduleItem } from "@/features/schedules/api";
import ComposeSheet from "@/components/ComposeSheet";
import { ClockIcon, UsersIcon } from "@/components/icons/index";
import ScheduleDetailNoteBlock from "@/components/ScheduleDetailNoteBlock";
import { parseEmojiPrefixedTitle } from "@/domain/categoryUi";
import { parseScheduleNote } from "@/domain/scheduleNote";
import { timeRangeLabel } from "@/domain/date";

type Props = {
  schedule: ScheduleItem;
  onClose: () => void;
  footer: ReactNode;
  onCancelledChange: (_next: boolean) => void | Promise<void>;
};

export default function ScheduleDetailSheet({
  schedule,
  onClose,
  footer,
  onCancelledChange
}: Props) {
  const titleText = parseEmojiPrefixedTitle(schedule.title).content || schedule.title;
  const subtitle = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex shrink-0 items-center gap-1">
        <ClockIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
        <span className="tabular-nums">{timeRangeLabel(schedule.startAt, schedule.endAt)}</span>
      </span>
      {(() => {
        const n = parseScheduleNote(schedule.note ?? "");
        const people = n.people.join(", ").trim();
        if (!people) return null;
        return (
          <>
            <span className="shrink-0">·</span>
            <span className="inline-flex min-w-0 max-w-full items-start gap-1">
              <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              <span className="min-w-0 break-words normal-case">{people}</span>
            </span>
          </>
        );
      })()}
      {schedule.repeatYearly ? (
        <>
          <span className="shrink-0">·</span>
          <span className="text-xs font-semibold text-indigo-600">매년 같은 날</span>
        </>
      ) : null}
    </div>
  );

  return (
    <ComposeSheet open title={titleText} subtitle={subtitle} onClose={onClose} footer={footer}>
      <ScheduleDetailNoteBlock
        title={schedule.title}
        note={schedule.note}
        cancelled={parseScheduleNote(schedule.note ?? "").cancelled}
        onCancelledChange={onCancelledChange}
      />
    </ComposeSheet>
  );
}
