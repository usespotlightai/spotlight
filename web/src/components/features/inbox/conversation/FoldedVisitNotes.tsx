import type { ReactElement } from 'react';

import { InboxNote } from '@/components/features/inbox/conversation/InboxNote';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { StationTag } from '@/components/features/inbox/conversation/StationTag';
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
import { cn } from '@/lib/utils';

type FoldedVisitNotesProps = {
  visit: FoldedVisit;
  item: ConversationItem;
  worked: readonly RunJournal[];
  className?: string;
  named?: boolean;
};

export function FoldedVisitNotes({
  visit,
  item,
  worked,
  className,
  named = false,
}: FoldedVisitNotesProps): ReactElement {
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
        className={cn('items-start pt-3 pb-4 pl-6', className)}
      />
    );
  }

  if (!notes.data) {
    return (
      <div
        aria-hidden
        className={cn('flex flex-col gap-1.5 pt-3 pb-4 pl-6', className)}
        data-slot="folded-visit-loading"
      >
        <StationNameSkeleton />
        <SkeletonLine className="w-3/5 text-sm leading-6" />
      </div>
    );
  }

  const all = notes.data;
  const shown = all.filter(showsInThread);

  return (
    <ol className={cn('flex flex-col gap-6 pt-3 pb-4 pl-6', className)}>
      {named && shown[0]?.voice !== 'station' && (
        <li>
          <StationTag
            name={visit.first.station}
            color={visit.first.stationColor}
            position={visit.first.stationPosition}
            count={item.station.count}
          />
        </li>
      )}
      {shown.map((note, at) =>
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
            <li
              key={note.position}
              className={cn(named && at === 0 && '-mx-3')}
            >
              <ThreadMessage note={note} teamId={item.teamId} />
            </li>
          )
        ),
      )}
    </ol>
  );
}
