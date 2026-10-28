import { X } from 'lucide-react';
import type { Ref } from 'react';
import { EntryOutcome } from '@/components/features/replays/outcome/EntryOutcome';
import { OutcomePart } from '@/components/features/replays/outcome/OutcomePart';
import { EntryResult } from '@/components/features/replays/replay/EntryResult';
import { EntryJudgeClaims } from '@/components/features/replays/run/EntryJudgeClaims';
import { EntryPairPasses } from '@/components/features/replays/run/EntryPairPasses';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  type EntryComparison,
  formatTitle,
  type ReplayEntry,
} from '@/lib/replay';
import { formatRepeat } from '@/lib/replay-words';
import { runPath } from '@/lib/run';

const ENTRY_PANE: PaneConfig = {
  storageKey: 'spotlight.replay-entry-width',
  min: 320,
  max: 960,
  initial: 520,
  label: 'Resize the task’s details',
};

const LINK =
  'text-muted-foreground text-xs underline-offset-2 hover:text-foreground hover:underline';

type EntryDetailProps = {
  slug: string;
  teamId: string;
  row: EntryComparison;
  referenceLabel: string;
  open: boolean;
  onClose: () => void;
  ref?: Ref<HTMLElement>;
};

export function EntryDetail({
  slug,
  teamId,
  row,
  referenceLabel,
  open,
  onClose,
  ref,
}: EntryDetailProps) {
  const side = (title: string, entry: ReplayEntry) => (
    <OutcomePart key={entry.repeat} title={title}>
      <div className="flex items-center gap-2 text-xs">
        <EntryResult entry={entry} runTo={null} reasons={false} />
        {entry.runId && (
          <TrailLink to={runPath(slug, teamId, entry.runId)} className={LINK}>
            Open the run
          </TrailLink>
        )}
      </div>
      {entry.judge?.claimResults && (
        <EntryJudgeClaims
          judge={entry.judge}
          marks={entry.judge.claimResults}
        />
      )}
      {entry.pair && (
        <EntryPairPasses
          pair={entry.pair}
          otherRunTo={runPath(slug, teamId, entry.pair.otherRunId)}
        />
      )}
      <EntryOutcome key={entry.runId ?? title} teamId={teamId} entry={entry} />
    </OutcomePart>
  );

  const sides = (title: string, repeats: readonly ReplayEntry[]) =>
    repeats.map((entry) =>
      side(
        repeats.length > 1
          ? `${title}, ${formatRepeat(entry.repeat).toLowerCase()}`
          : title,
        entry,
      ),
    );

  return (
    <SidePane pane={ENTRY_PANE} open={open} ref={ref}>
      <div className="flex items-center gap-2 px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
          {formatTitle(row.title)}
        </h2>
        <TrailLink
          to={runPath(slug, teamId, row.originalRunId)}
          className={LINK}
        >
          Original run
        </TrailLink>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the task’s details"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <ScrollArea
        className="min-h-0 flex-1"
        contentClassName="min-h-full flex flex-col gap-8 px-4 pt-2 pb-6"
      >
        {sides(
          row.baseline.length > 0 ? 'This replay' : 'Result',
          row.candidate,
        )}
        {sides(referenceLabel, row.baseline)}
      </ScrollArea>
    </SidePane>
  );
}
