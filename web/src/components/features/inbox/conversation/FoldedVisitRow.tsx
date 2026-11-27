import { use, useId, useState } from 'react';

import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FoldedVisitNotes } from '@/components/features/inbox/conversation/FoldedVisitNotes';
import { ThreadMessage } from '@/components/features/inbox/conversation/ThreadMessage';
import { Collapsible } from '@/components/shared/Collapsible';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { usePrefetchTaskNotes } from '@/hooks/api/useTaskNotes';
import { useOpenIntent } from '@/hooks/useOpenIntent';
import { previewOf } from '@/lib/folded-visit';
import type {
  ConversationItem,
  FoldedVisit,
  JournalledRun,
  RunJournal,
} from '@/lib/inbox';
import { JournalDemandContext } from '@/lib/journal-demand';
import { nonEmpty } from '@/lib/non-empty';
import { since } from '@/lib/since';
import { stationShare } from '@/lib/station';

const AVATAR_ROOM = '-mr-2 pr-2';

const runsDuring = (
  runs: readonly JournalledRun[],
  visit: FoldedVisit,
): string[] => {
  const from = Date.parse(visit.first.at);
  const until = Date.parse(visit.endedAt);
  const during = runs
    .filter((run) => {
      const at = Date.parse(run.createdAt);
      return at >= from && at <= until;
    })
    .map((run) => run.runId);

  return nonEmpty(visit.first.runId) ? [visit.first.runId, ...during] : during;
};

type FoldedVisitRowProps = {
  visit: FoldedVisit;
  item: ConversationItem;
  worked: readonly RunJournal[];
};

export function FoldedVisitRow({ visit, item, worked }: FoldedVisitRowProps) {
  const [open, setOpen] = useState(false);
  const shown = useId();
  const { first, answers } = visit;
  const prefetch = usePrefetchTaskNotes();
  const journals = use(JournalDemandContext);
  const intent = useOpenIntent(() => {
    prefetch({
      teamId: item.teamId,
      taskId: item.taskId,
      from: first.position,
      to: visit.to,
    });
    journals.want(runsDuring(journals.runs, visit));
  });

  return (
    <div data-slot="folded-visit" className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        {...intent}
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
        {visit.passedBack && (
          <span className="shrink-0 text-foreground">Passed it back.</span>
        )}
        <span className="hidden min-w-0 flex-1 truncate text-muted-foreground @md/pane:block">
          {previewOf(visit)}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground text-xs @md/pane:ml-0">
          {since(visit.endedAt)}
        </span>
        <ExpandChevron open={open} className="shrink-0 text-muted-foreground" />
      </button>

      <Collapsible open={open} appear={false} lazy className={AVATAR_ROOM}>
        <div id={shown}>
          <FoldedVisitNotes visit={visit} item={item} worked={worked} />
        </div>
      </Collapsible>

      {answers.length > 0 && (
        <Collapsible open={!open} appear={false} lazy className={AVATAR_ROOM}>
          <ol className="flex flex-col gap-6 pt-2 pb-3 pl-6">
            {answers.map((answer) => (
              <li key={answer.position}>
                <ThreadMessage note={answer} teamId={item.teamId} />
              </li>
            ))}
          </ol>
        </Collapsible>
      )}
    </div>
  );
}
