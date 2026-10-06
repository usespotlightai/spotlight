import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { ClampedCell } from '@/components/shared/nested-table/ClampedCell';
import { ExpandingRow } from '@/components/shared/nested-table/ExpandingRow';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { countShown, type StationNames, stationShown } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';
import { dayShown } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import { stationPath } from '@/lib/station';
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
              'col-span-full flex min-w-0 tabular-nums @4xl:col-span-1',
              EDGE_INDENT,
            )}
          >
            <ExpandToggle expansion={expansion}>
              {dayShown(marker.firstRunAt.slice(0, 10))}
            </ExpandToggle>
          </div>

          <TrailLink
            to={linePath(slug, teamId, marker.lineId)}
            className="min-w-0 truncate text-muted-foreground text-xs hover:text-foreground hover:underline"
          >
            {names.get(marker.stationId)?.lineName ?? 'Removed line'}
          </TrailLink>

          <TrailLink
            to={stationPath(slug, teamId, marker.lineId, marker.stationId)}
            className="min-w-0 truncate font-medium text-foreground text-xs hover:underline"
          >
            {stationShown(names, marker.stationId)}
          </TrailLink>

          <ClampedCell expansion={expansion}>
            {marker.changes.length > 0 ? (
              <ConfigPlan changes={marker.changes} />
            ) : (
              <p className="text-muted-foreground text-xs">
                Config not on record
              </p>
            )}
          </ClampedCell>

          <NestedCell heading="Runs before">
            {countShown(marker.before.runs)}
          </NestedCell>
          <NestedCell heading="Runs after">
            {countShown(marker.after.runs)}
          </NestedCell>

          <button
            type="button"
            aria-pressed={shown}
            onClick={() => (shown ? panel.close() : panel.show(marker))}
            className={pillClass(
              'outline',
              'justify-self-start whitespace-nowrap @4xl:justify-self-end',
            )}
          >
            Impact
          </button>
        </>
      )}
    </ExpandingRow>
  );
}
