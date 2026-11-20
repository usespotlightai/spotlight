import { memo, useMemo } from 'react';

import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useBeforeAfterActions } from '@/lib/before-after-panel';
import { configPlan } from '@/lib/config-plan';
import { formatCount, formatStation, type StationNames } from '@/lib/insights';
import type { ChangeMarker } from '@/lib/insights-changes';
import { formatDay } from '@/lib/judge';
import { configChangesOf } from '@/lib/station-config';
import { linePath } from '@/lib/team';
import { cn } from '@/lib/utils';

const LINK_TOUCH_TARGET = 'pointer-coarse:-my-2 pointer-coarse:py-2';

// The links sit above the button that makes the whole row a target.
const ABOVE_ROW = 'relative z-10';

type ChangeMarkerRowProps = {
  slug: string;
  teamId: string;
  marker: ChangeMarker;
  names: StationNames;
  shown: boolean;
};

export const ChangeMarkerRow = memo(function ChangeMarkerRow({
  slug,
  teamId,
  marker,
  names,
  shown,
}: ChangeMarkerRowProps) {
  const { show, close } = useBeforeAfterActions();
  const entries = useMemo(
    () => configPlan(configChangesOf(marker.changes)),
    [marker.changes],
  );
  const station = formatStation(names, marker.stationId);
  const day = formatDay(marker.firstRunAt.slice(0, 10));

  return (
    <li
      data-slot="change-marker"
      className={cn(
        TABLE_ROW,
        ROW_DIVIDER,
        'cursor-pointer pointer-coarse:min-h-11',
        'has-[[data-pick]:focus-visible]:ring-1 has-[[data-pick]:focus-visible]:ring-primary has-[[data-pick]:focus-visible]:ring-inset',
        shown && 'bg-selected hover:bg-selected dark:hover:bg-selected',
      )}
    >
      <div className={cn(LEAD_CELL, EDGE_INDENT)}>
        <button
          type="button"
          data-pick
          aria-pressed={shown}
          aria-label={`Impact of the ${station} change, first run ${day}`}
          onClick={() => (shown ? close() : show(marker))}
          className="text-left text-foreground tabular-nums outline-none after:absolute after:inset-0"
        >
          {day}
        </button>
      </div>

      <TrailLink
        to={linePath(slug, teamId, marker.lineId)}
        className={cn(
          'min-w-0 truncate text-muted-foreground hover:text-foreground hover:underline',
          ABOVE_ROW,
          LINK_TOUCH_TARGET,
        )}
      >
        {names.get(marker.stationId)?.lineName ?? 'Removed line'}
      </TrailLink>

      <InsightsLink
        tab="stations"
        filter={{ stationId: marker.stationId }}
        className={cn(
          'min-w-0 truncate text-foreground hover:underline',
          ABOVE_ROW,
          LINK_TOUCH_TARGET,
        )}
      >
        {station}
      </InsightsLink>

      <div className="col-span-full max-h-4 min-w-0 overflow-hidden @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1">
        {marker.changes.length > 0 ? (
          <ConfigPlan entries={entries} firstLine />
        ) : (
          <p className="text-muted-foreground">Config not on record</p>
        )}
      </div>

      <NestedCell heading="Runs before">
        {formatCount(marker.before.runs)}
      </NestedCell>
      <NestedCell heading="Runs after">
        {formatCount(marker.after.runs)}
      </NestedCell>
    </li>
  );
});
