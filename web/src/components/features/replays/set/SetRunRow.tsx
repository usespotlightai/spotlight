import { X } from 'lucide-react';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { useRemoveReplaySetEntry } from '@/hooks/api/useRemoveReplaySetEntry';
import {
  formatTitle,
  type ReplayedStation,
  type ReplaySetEntry,
} from '@/lib/replay';
import {
  formatReplayable,
  formatRunState,
  RUNS_FROZEN_BY_SEARCH,
} from '@/lib/replay-words';
import { runPath } from '@/lib/run';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type SetRunRowProps = {
  at: ReplayedStation;
  setId: string;
  entry: ReplaySetEntry;
  frozen: boolean;
};

export function SetRunRow({ at, setId, entry, frozen }: SetRunRowProps) {
  const remove = useRemoveReplaySetEntry();
  const title = formatTitle(entry.title);

  return (
    <li data-slot="set-run" className={cn(TABLE_ROW, ROW_DIVIDER, 'group/run')}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <TrailLink
          to={runPath(at.slug, at.teamId, entry.runId)}
          className="truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {title}
        </TrailLink>
        {entry.unreplayableReason && (
          <NotedWarning
            tone="destructive"
            label={formatReplayable(entry.unreplayableReason)}
            note={formatReplayable(entry.unreplayableReason)}
            className="relative z-10"
          />
        )}
      </span>
      <NestedCell heading="State" numeric={false}>
        {entry.state ? formatRunState(entry.state) : 'Unknown run'}
      </NestedCell>
      <NestedCell heading="Ended">
        {entry.endedAt ? since(entry.endedAt) : '–'}
      </NestedCell>
      <span className="relative z-10 flex h-4 items-center justify-end">
        <DisabledReasonTooltip reason={frozen ? RUNS_FROZEN_BY_SEARCH : null}>
          {(describedBy) => (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="opacity-0 focus-visible:opacity-100 group-hover/run:opacity-100"
              aria-label={`Take ${title} out of the set`}
              aria-describedby={describedBy}
              disabled={remove.isPending || frozen}
              onClick={() =>
                remove.mutate({ teamId: at.teamId, setId, runId: entry.runId })
              }
            >
              <X aria-hidden />
            </Button>
          )}
        </DisabledReasonTooltip>
      </span>
    </li>
  );
}
