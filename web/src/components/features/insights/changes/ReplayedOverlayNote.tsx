import type { UseQueryResult } from '@tanstack/react-query';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import {
  type InsightsCandidates,
  type ReplayedPoint,
  replayedNote,
} from '@/lib/insights-candidates';
import { failed, loading } from '@/lib/query';

type ReplayedOverlayNoteProps = {
  stationId: string | null;
  replayed: readonly ReplayedPoint[] | null;
  drawn: boolean;
  scattered: boolean;
  hiddenFor: string | null;
  candidates: UseQueryResult<InsightsCandidates>;
};

const NOTE = 'text-muted-foreground text-xs';

export function ReplayedOverlayNote({
  stationId,
  replayed,
  drawn,
  scattered,
  hiddenFor,
  candidates,
}: ReplayedOverlayNoteProps) {
  if (!stationId) {
    return null;
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

  if (loading(candidates) || !replayed) {
    return null;
  }

  if (hiddenFor) {
    return (
      <p data-slot="replayed-note" className={NOTE}>
        Replayed points show success only. They’re hidden while the chart shows{' '}
        {hiddenFor}.
      </p>
    );
  }

  return (
    <>
      {!scattered && replayed.length > 0 && (
        <p data-slot="replayed-note" className={NOTE}>
          Replayed candidates aren’t drawn. No live setup has a priced outcome.
          The table lists them.
        </p>
      )}
      {drawn && (
        <p data-slot="replayed-note" className={NOTE}>
          {replayedNote(replayed)}
        </p>
      )}
    </>
  );
}
