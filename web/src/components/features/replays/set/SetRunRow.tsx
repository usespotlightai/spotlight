import { RemoveSetRunButton } from '@/components/features/replays/set/RemoveSetRunButton';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  formatTitle,
  type ReplayedStation,
  type ReplaySetEntry,
} from '@/lib/replay';
import { formatReplayable, formatRunState } from '@/lib/replay-words';
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
          <WarningTooltip
            tone="destructive"
            label={formatReplayable(entry.unreplayableReason)}
            tooltip={formatReplayable(entry.unreplayableReason)}
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
        <RemoveSetRunButton
          at={at}
          setId={setId}
          runId={entry.runId}
          title={title}
          frozen={frozen}
        />
      </span>
    </li>
  );
}
