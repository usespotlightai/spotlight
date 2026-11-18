import { useId, useState } from 'react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { InboxNote } from '@/components/features/inbox/conversation/InboxNote';
import { ThreadMessage } from '@/components/features/inbox/conversation/ThreadMessage';
import { Collapsible } from '@/components/shared/Collapsible';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { answerOf, endedAt, headOf, previewOf } from '@/lib/folded-visit';
import {
  type ConversationItem,
  type FoldedVisit,
  type RunJournal,
  showsInThread,
  workedOn,
} from '@/lib/inbox';
import { since } from '@/lib/since';
import { stationShare } from '@/lib/station';
import { showsMessage } from '@/lib/thread-message';

type FoldedVisitRowProps = {
  visit: FoldedVisit;
  stationCount: number;
  teamId: string | undefined;
  about: ConversationItem['about'];
  worked: readonly RunJournal[];
};

export function FoldedVisitRow({
  visit,
  stationCount,
  teamId,
  about,
  worked,
}: FoldedVisitRowProps) {
  const [open, setOpen] = useState(false);
  const shown = useId();
  const head = headOf(visit);
  const answer = answerOf(visit);
  const ended = endedAt(visit);
  const notes = visit.notes.filter(showsInThread);

  if (!head) {
    return null;
  }

  return (
    <div data-slot="folded-visit" className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={shown}
        className="-mx-2 flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-10"
      >
        <StationIcon
          share={stationShare(head.stationPosition, stationCount)}
          color={head.stationColor}
        />
        <span className="shrink-0 font-medium text-foreground">
          {head.station}
        </span>
        {visit.sentBack && (
          <span className="shrink-0 text-foreground">Sent it back.</span>
        )}
        <span className="hidden min-w-0 flex-1 truncate text-muted-foreground @md/pane:block">
          {previewOf(visit)}
        </span>
        {ended && (
          <span className="ml-auto shrink-0 text-muted-foreground text-xs @md/pane:ml-0">
            {since(ended)}
          </span>
        )}
        <ExpandChevron open={open} className="shrink-0 text-muted-foreground" />
      </button>

      {answer && !open && (
        <div className="pt-2 pb-3 pl-6">
          <ThreadMessage note={answer} teamId={teamId} />
        </div>
      )}

      <Collapsible open={open} appear={false} lazy>
        <ol id={shown} className="flex flex-col gap-6 pt-3 pb-4 pl-6">
          {notes.map((note) =>
            note.voice === 'station' ? (
              <InboxNote
                key={note.position}
                note={note}
                stationCount={stationCount}
                teamId={teamId}
                about={about}
                resolved
                worked={workedOn(worked, visit.notes, note.runId, note.at)}
              />
            ) : (
              showsMessage(note) && (
                <li key={note.position}>
                  <ThreadMessage note={note} teamId={teamId} />
                </li>
              )
            ),
          )}
        </ol>
      </Collapsible>
    </div>
  );
}
