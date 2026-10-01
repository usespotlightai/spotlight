import { ChangeMarkerRow } from '@/components/features/insights/changes/ChangeMarkerRow';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import type { StationNames } from '@/lib/insights';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';

type ChangeMarkerListProps = {
  slug: string;
  teamId: string;
  markers: readonly ChangeMarker[];
  names: StationNames;
};

export function ChangeMarkerList({
  slug,
  teamId,
  markers,
  names,
}: ChangeMarkerListProps) {
  return (
    <InsightsCard
      title="Config changes"
      description="Each time a station started a new config, the latest first. Open one to see how its runs went before and after."
    >
      {markers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No station changed its config in this period.
        </p>
      ) : (
        <ul
          aria-label="Config changes"
          className="flex flex-col divide-y-[0.5px] divide-border"
        >
          {[...markers].reverse().map((marker) => (
            <ChangeMarkerRow
              key={changeKey(marker)}
              slug={slug}
              teamId={teamId}
              marker={marker}
              names={names}
            />
          ))}
        </ul>
      )}
    </InsightsCard>
  );
}
