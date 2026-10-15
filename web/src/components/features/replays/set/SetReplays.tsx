import type { UseQueryResult } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { StateBox } from '@/components/features/replays/StateBox';
import { ReplayRow } from '@/components/features/replays/set/ReplayRow';
import { StartReplayButton } from '@/components/features/replays/set/StartReplayButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { PanelActions } from '@/components/shared/PanelActions';
import { failed, loading } from '@/lib/query';
import {
  baselineIn,
  newestFirst,
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  SET_REPLAY_HEADINGS,
  startRefusal,
} from '@/lib/replay';

const REPLAYS_NOTE =
  'Each replay reruns the set under one config. The baseline is the latest replay of the live config. Gain: the change in success over the replay it is compared with, on the tasks both scored';

type SetReplaysProps = {
  at: ReplayedStation;
  set: ReplaySet;
  replays: UseQueryResult<Replay[]>;
};

export function SetReplays({ at, set, replays }: SetReplaysProps) {
  const listed = newestFirst(replays.data ?? []);
  const baseline = baselineIn(listed);
  const start = (
    <StartReplayButton
      at={at}
      set={set}
      baseline={baseline}
      refusedBecause={startRefusal(set)}
    />
  );

  let body: ReactNode;

  if (loading(replays)) {
    body = (
      <NestedTableSkeleton
        label="Loading the replays"
        headings={SET_REPLAY_HEADINGS}
        compact
      />
    );
  } else if (failed(replays)) {
    body = (
      <StateBox flat>
        <CouldNotLoad
          what="The set’s replays"
          retrying={replays.isFetching}
          onRetry={() => void replays.refetch()}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox flat>
        <EmptyState icon={Play} title="Not replayed yet" action={start}>
          Replay the live config first. It becomes the baseline.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <NestedTable label="Replays" headings={SET_REPLAY_HEADINGS} compact>
        {listed.map((replay) => (
          <ReplayRow
            key={replay.id}
            at={at}
            replay={replay}
            baselineId={baseline?.id ?? null}
          />
        ))}
      </NestedTable>
    );
  }

  return (
    <InsightsCard tableOnly title="Replays" description={REPLAYS_NOTE}>
      {body}
      {listed.length > 0 && <PanelActions>{start}</PanelActions>}
    </InsightsCard>
  );
}
