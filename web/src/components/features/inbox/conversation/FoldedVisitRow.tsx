import { useId, useState } from 'react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FoldedVisitNotes } from '@/components/features/inbox/conversation/FoldedVisitNotes';
import { ThreadMessage } from '@/components/features/inbox/conversation/ThreadMessage';
import { Collapsible } from '@/components/shared/Collapsible';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { previewOf } from '@/lib/folded-visit';
import type { ConversationItem, FoldedVisit, RunJournal } from '@/lib/inbox';
import { since } from '@/lib/since';
import { stationShare } from '@/lib/station';

type FoldedVisitRowProps = {
  visit: FoldedVisit;
  item: ConversationItem;
  worked: readonly RunJournal[];
};

export function FoldedVisitRow({ visit, item, worked }: FoldedVisitRowProps) {
  const [open, setOpen] = useState(false);
  const shown = useId();
  const { first, answer } = visit;

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
          share={stationShare(first.stationPosition, item.station.count)}
          color={first.stationColor}
        />
        <span className="shrink-0 font-medium text-foreground">
          {first.station}
        </span>
        {visit.sentBack && (
          <span className="shrink-0 text-foreground">Sent it back.</span>
        )}
        <span className="hidden min-w-0 flex-1 truncate text-muted-foreground @md/pane:block">
          {previewOf(visit)}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground text-xs @md/pane:ml-0">
          {since(visit.endedAt)}
        </span>
        <ExpandChevron open={open} className="shrink-0 text-muted-foreground" />
      </button>

      {answer && !open && (
        <div className="pt-2 pb-3 pl-6">
          <ThreadMessage note={answer} teamId={item.teamId} />
        </div>
      )}

      <Collapsible open={open} appear={false} lazy>
        <div id={shown}>
          <FoldedVisitNotes visit={visit} item={item} worked={worked} />
        </div>
      </Collapsible>
    </div>
  );
}
