import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { ClampedCell } from '@/components/shared/nested-table/ClampedCell';
import { ExpandingRow } from '@/components/shared/nested-table/ExpandingRow';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { formatCount, formatStation, type StationNames } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';
import { formatDay } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import { linePath } from '@/lib/team';
import { cn } from '@/lib/utils';

type ChangeMarkerRowProps = {
  slug: string;
  teamId: string;
  marker: ChangeMarker;
  names: StationNames;
};

export function ChangeMarkerRow({
  slug,
  teamId,
  marker,
  names,
}: ChangeMarkerRowProps) {
  const panel = useBeforeAfterPanel();
  const shown =
    panel.shown !== null && changeKey(panel.shown) === changeKey(marker);

  return (
    <ExpandingRow slot="change-marker" className={ROW_DIVIDER}>
      {(expansion) => (
        <>
          <div
            className={cn(
              'col-span-full flex min-w-0 tabular-nums @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1',
              EDGE_INDENT,
            )}
          >
            <ExpandToggle expansion={expansion}>
              {formatDay(marker.firstRunAt.slice(0, 10))}
            </ExpandToggle>
          </div>

          <TrailLink
            to={linePath(slug, teamId, marker.lineId)}
            className="min-w-0 truncate text-muted-foreground hover:text-foreground hover:underline"
          >
            {names.get(marker.stationId)?.lineName ?? 'Removed line'}
          </TrailLink>

          <InsightsLink
            tab="stations"
            filter={{ stationId: marker.stationId }}
            className="min-w-0 truncate text-foreground hover:underline"
          >
            {formatStation(names, marker.stationId)}
          </InsightsLink>

          <ClampedCell expansion={expansion}>
            {marker.changes.length > 0 ? (
              <ConfigPlan changes={marker.changes} />
            ) : (
              <p className="text-muted-foreground">Config not on record</p>
            )}
          </ClampedCell>

          <NestedCell heading="Runs before">
            {formatCount(marker.before.runs)}
          </NestedCell>
          <NestedCell heading="Runs after">
            {formatCount(marker.after.runs)}
          </NestedCell>

          <button
            type="button"
            aria-pressed={shown}
            onClick={() => (shown ? panel.close() : panel.show(marker))}
            className={pillClass(
              shown ? 'default' : 'outline',
              '-my-0.5 justify-self-start whitespace-nowrap @4xl:justify-self-end @lg:group-data-compact/nested:justify-self-end',
            )}
          >
            Impact
          </button>
        </>
      )}
    </ExpandingRow>
  );
}
