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
import { RowDetail } from '@/components/shared/nested-table/RowDetail';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { hasTextDiff } from '@/lib/config-plan';
import { formatCount, formatStation, type StationNames } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';
import { formatDay } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import { linePath } from '@/lib/team';
import { cn } from '@/lib/utils';

const LINK_TOUCH_TARGET = 'pointer-coarse:-my-2 pointer-coarse:py-2';

const PILL_TOUCH_TARGET =
  'relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2';

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
  const wide = hasTextDiff(marker.changes);

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
            className={cn(
              'min-w-0 truncate text-muted-foreground hover:text-foreground hover:underline',
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
              LINK_TOUCH_TARGET,
            )}
          >
            {formatStation(names, marker.stationId)}
          </InsightsLink>

          <ClampedCell expansion={expansion} pinned={wide}>
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
              cn(
                '-my-0.5 justify-self-start whitespace-nowrap @4xl:justify-self-end @lg:group-data-compact/nested:justify-self-end',
                PILL_TOUCH_TARGET,
              ),
            )}
          >
            Impact
          </button>

          {wide && (
            <RowDetail className="col-[4/-1]">
              <ConfigPlan changes={marker.changes} />
            </RowDetail>
          )}
        </>
      )}
    </ExpandingRow>
  );
}
