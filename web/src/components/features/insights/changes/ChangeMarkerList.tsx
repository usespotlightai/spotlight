import { type ReactElement, useMemo } from 'react';

import { ChangeMarkerRow } from '@/components/features/insights/changes/ChangeMarkerRow';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { useBeforeAfterShown } from '@/lib/before-after-panel';
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
}: ChangeMarkerListProps): ReactElement {
  const shown = useBeforeAfterShown();
  const shownKey = shown && changeKey(shown);
  const latestFirst = useMemo(() => [...markers].reverse(), [markers]);

  return (
    <InsightsCard flat title="Changes this period" description={CHANGES_NOTE}>
      {markers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No station changed its config in this period.
        </p>
      ) : (
        <NestedTable label="Config changes" headings={CHANGE_HEADINGS} compact>
          {latestFirst.map((marker) => (
            <ChangeMarkerRow
              key={changeKey(marker)}
              slug={slug}
              teamId={teamId}
              marker={marker}
              names={names}
              shown={changeKey(marker) === shownKey}
            />
          ))}
        </NestedTable>
      )}
    </InsightsCard>
  );
}
