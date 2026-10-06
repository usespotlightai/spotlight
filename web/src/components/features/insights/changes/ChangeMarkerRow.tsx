import { ConfigPlan } from '@/components/features/insights/changes/ConfigPlan';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { countShown, type StationNames, stationShown } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';
import { dayShown } from '@/lib/judge';
import { stationPath } from '@/lib/station';
import { linePath } from '@/lib/team';

type ChangeMarkerRowProps = {
  slug: string;
  teamId: string;
  marker: ChangeMarker;
  names: StationNames;
};

const COMPARED = [
  { id: 'before', heading: 'Runs before' },
  { id: 'after', heading: 'Runs after' },
] as const;

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
    <li
      data-slot="change-marker"
      className="col-span-full grid grid-cols-2 items-baseline gap-x-6 gap-y-2 py-3 last:pb-1 @3xl:grid-cols-subgrid"
    >
      <span className="text-muted-foreground text-xs tabular-nums @3xl:whitespace-nowrap">
        {dayShown(marker.firstRunAt.slice(0, 10))}
      </span>

      <TrailLink
        to={linePath(slug, teamId, marker.lineId)}
        className="min-w-0 truncate text-muted-foreground text-sm hover:text-foreground hover:underline"
      >
        {names.get(marker.stationId)?.lineName ?? 'Removed line'}
      </TrailLink>

      <TrailLink
        to={stationPath(slug, teamId, marker.lineId, marker.stationId)}
        className="min-w-0 truncate font-medium text-foreground text-sm hover:underline"
      >
        {stationShown(names, marker.stationId)}
      </TrailLink>

      <div className="col-span-full min-w-0 @3xl:col-span-1">
        {marker.changes.length > 0 ? (
          <ConfigPlan changes={marker.changes} />
        ) : (
          <p className="text-muted-foreground text-xs">Config not on record</p>
        )}
      </div>

      {COMPARED.map(({ id, heading }) => (
        <span
          key={id}
          className="text-muted-foreground text-xs tabular-nums @3xl:text-right"
        >
          <span className="@3xl:hidden">{heading} </span>
          {countShown(marker[id].runs)}
        </span>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={shown}
        onClick={() => (shown ? panel.close() : panel.show(marker))}
        className="justify-self-start rounded-full bg-card shadow-none @3xl:justify-self-end"
      >
        Before and after
      </Button>
    </li>
  );
}
