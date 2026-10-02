import type { UseQueryResult } from '@tanstack/react-query';
import { UnchartedNotes } from '@/components/features/insights/candidates/UnchartedNotes';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import {
  chartedNothing,
  type InsightsCandidates,
  type ReplayedChart,
  replayedNote,
} from '@/lib/insights-candidates';
import { failed, loading } from '@/lib/query';

type ReplayedOverlayNoteProps = {
  stationId: string | null;
  chart: ReplayedChart | null;
  drawn: boolean;
  scattered: boolean;
  hiddenFor: string | null;
  priced: boolean;
  candidates: UseQueryResult<InsightsCandidates>;
};

const NOTE = 'text-muted-foreground text-xs';

export function ReplayedOverlayNote({
  stationId,
  chart,
  drawn,
  scattered,
  hiddenFor,
  priced,
  candidates,
}: ReplayedOverlayNoteProps) {
  if (!stationId) {
    return (candidates.data?.stations.length ?? 0) > 0 ? (
      <p data-slot="replayed-note" className={NOTE}>
        Pick a station to see its replayed candidates beside its live setups.
      </p>
    ) : null;
  }

  if (failed(candidates)) {
    return (
      <CouldNotLoad
        what="The replayed candidates"
        retrying={candidates.isFetching}
        onRetry={() => void candidates.refetch()}
        className="items-start"
      />
    );
  }

  if (loading(candidates) || !chart || chartedNothing(chart)) {
    return null;
  }

  if (hiddenFor) {
    return (
      <p data-slot="replayed-note" className={NOTE}>
        Replayed points show success, so they’re hidden while the chart shows{' '}
        {hiddenFor}.
      </p>
    );
  }

  return (
    <>
      {!scattered && chart.priced.length > 0 && (
        <p data-slot="replayed-note" className={NOTE}>
          This station’s replayed candidates are not drawn, as no live setup
          here has a priced outcome to set them beside. The table lists them.
        </p>
      )}
      {drawn && (
        <p data-slot="replayed-note" className={NOTE}>
          {replayedNote(chart.priced)}
        </p>
      )}
      <UnchartedNotes chart={chart} priced={priced} />
    </>
  );
}
