import { ConfigChanges } from '@/components/features/stations/ConfigChanges';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import { countShown, type StationNames, stationShown } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';
import { dayShown } from '@/lib/judge';
import { stationPath } from '@/lib/station';

type ChangeMarkerRowProps = {
  slug: string;
  teamId: string;
  marker: ChangeMarker;
  names: StationNames;
};

const runs = (count: number): string =>
  `${countShown(count)} ${count === 1 ? 'run' : 'runs'}`;

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
      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
    >
      <div className="flex min-w-64 flex-1 flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground text-xs tabular-nums">
            {dayShown(marker.firstRunAt.slice(0, 10))}
          </span>
          <TrailLink
            to={stationPath(slug, teamId, marker.lineId, marker.stationId)}
            className="font-medium text-foreground hover:underline"
          >
            {stationShown(names, marker.stationId)}
          </TrailLink>
        </p>
        {marker.changes.length > 0 ? (
          <ConfigChanges changes={marker.changes} />
        ) : (
          <p className="text-muted-foreground text-xs">
            No earlier config to compare with
          </p>
        )}
      </div>

      <p className="text-muted-foreground text-xs tabular-nums">
        {runs(marker.before.runs)} before · {runs(marker.after.runs)} after
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={shown}
        onClick={() => (shown ? panel.close() : panel.show(marker))}
        className="rounded-full bg-card shadow-none"
      >
        Before and after
      </Button>
    </li>
  );
}
