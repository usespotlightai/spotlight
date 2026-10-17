import { ChangeMarkerRow } from '@/components/features/insights/changes/ChangeMarkerRow';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import type { StationNames } from '@/lib/insights';
import {
  CHANGE_HEADINGS,
  CHANGES_NOTE,
  type ChangeMarker,
  changeKey,
} from '@/lib/insights-changes';

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
    <InsightsCard title="Config changes" description={CHANGES_NOTE}>
      {markers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No station changed its config in this period.
        </p>
      ) : (
        <NestedTable label="Config changes" headings={CHANGE_HEADINGS} trailing>
          {[...markers].reverse().map((marker) => (
            <ChangeMarkerRow
              key={changeKey(marker)}
              slug={slug}
              teamId={teamId}
              marker={marker}
              names={names}
            />
          ))}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
