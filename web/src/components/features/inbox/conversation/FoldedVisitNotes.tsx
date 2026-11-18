import { InboxNote } from '@/components/features/inbox/conversation/InboxNote';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { ThreadMessage } from '@/components/features/inbox/conversation/ThreadMessage';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useTaskNotes } from '@/hooks/api/useTaskNotes';
import {
  type ConversationItem,
  type FoldedVisit,
  type RunJournal,
  showsInThread,
  workedOn,
} from '@/lib/inbox';
import { showsMessage } from '@/lib/thread-message';

type FoldedVisitNotesProps = {
  visit: FoldedVisit;
  item: ConversationItem;
  worked: readonly RunJournal[];
};

export function FoldedVisitNotes({
  visit,
  item,
  worked,
}: FoldedVisitNotesProps) {
  const notes = useTaskNotes({
    teamId: item.teamId,
    taskId: item.taskId,
    from: visit.first.position,
    to: visit.to,
  });

  if (notes.isError) {
    return (
      <CouldNotLoad
        what="The notes of this visit"
        retrying={notes.isFetching}
        onRetry={() => void notes.refetch()}
        className="items-start pt-3 pb-4 pl-6"
      />
    );
  }

  if (!notes.data) {
    return (
      <div
        aria-hidden
        className="flex flex-col gap-1.5 pt-3 pb-4 pl-6"
        data-slot="folded-visit-loading"
      >
        <StationNameSkeleton />
        <SkeletonLine className="w-3/5 text-sm leading-6" />
      </div>
    );
  }

  const all = notes.data;

  return (
    <ol className="flex flex-col gap-6 pt-3 pb-4 pl-6">
      {all.filter(showsInThread).map((note) =>
        note.voice === 'station' ? (
          <InboxNote
            key={note.position}
            note={note}
            stationCount={item.station.count}
            teamId={item.teamId}
            about={item.about}
            resolved
            worked={workedOn(worked, all, note.runId, note.at)}
          />
        ) : (
          showsMessage(note) && (
            <li key={note.position}>
              <ThreadMessage note={note} teamId={item.teamId} />
            </li>
          )
        ),
      )}
    </ol>
  );
}
