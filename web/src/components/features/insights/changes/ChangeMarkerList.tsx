import { ChangeHeadings } from '@/components/features/insights/changes/ChangeHeadings';
import { ChangeMarkerRow } from '@/components/features/insights/changes/ChangeMarkerRow';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import type { StationNames } from '@/lib/insights';
import { adoptedFrom, type ConfigOrigin } from '@/lib/insights-candidates';
import { type ChangeMarker, changeKey } from '@/lib/insights-changes';

type ChangeMarkerListProps = {
  slug: string;
  teamId: string;
  markers: readonly ChangeMarker[];
  origins: readonly ConfigOrigin[];
  names: StationNames;
};

export function ChangeMarkerList({
  slug,
  teamId,
  markers,
  origins,
  names,
}: ChangeMarkerListProps) {
  return (
    <InsightsCard
      title="Config changes"
      description="Every station config change, latest first. Open one to compare runs before and after."
    >
      {markers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No station changed its config in this period.
        </p>
      ) : (
        <div className="@container">
          <div className="grid gap-x-6 @3xl:grid-cols-[max-content_minmax(8rem,14rem)_minmax(0,1fr)_repeat(3,max-content)]">
            <ChangeHeadings />

            <ul
              aria-label="Config changes"
              className="col-span-full grid grid-cols-subgrid divide-y divide-border"
            >
              {[...markers].reverse().map((marker) => (
                <ChangeMarkerRow
                  key={changeKey(marker)}
                  slug={slug}
                  teamId={teamId}
                  marker={marker}
                  adopted={adoptedFrom(origins, marker, slug, teamId)}
                  names={names}
                />
              ))}
            </ul>
          </div>
        </div>
      )}
    </InsightsCard>
  );
}
