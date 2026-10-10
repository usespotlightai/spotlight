import { LatestReplay } from '@/components/features/replays/station/LatestReplay';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  type ReplayedStation,
  type ReplaySet,
  replaySetPath,
} from '@/lib/replay';
import { cn } from '@/lib/utils';

type ReplaySetRowProps = {
  at: ReplayedStation;
  set: ReplaySet;
};

export function ReplaySetRow({ at, set }: ReplaySetRowProps) {
  return (
    <li data-slot="replay-set" className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <TrailLink
          to={replaySetPath(at, set.id)}
          className="truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {set.name}
        </TrailLink>
        {set.stationGone && <Pill>Station gone</Pill>}
      </span>
      <NestedCell heading="Runs">{set.entries.length}</NestedCell>
      <NestedCell heading="Latest replay" numeric={false}>
        <LatestReplay teamId={at.teamId} setId={set.id} />
      </NestedCell>
    </li>
  );
}
