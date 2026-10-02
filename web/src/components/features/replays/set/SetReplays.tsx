import type { UseQueryResult } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { ReplayRow } from '@/components/features/replays/set/ReplayRow';
import { StartReplayButton } from '@/components/features/replays/set/StartReplayButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { failed, loading } from '@/lib/query';
import {
  baselineIn,
  newestFirst,
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  startRefusal,
} from '@/lib/replay';

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
      hasBaseline={baseline !== null}
      refusedBecause={startRefusal(set)}
    />
  );

  let body: ReactNode;

  if (loading(replays)) {
    body = <RowsSkeleton label="Loading the replays" />;
  } else if (failed(replays)) {
    body = (
      <StateBox>
        <CouldNotLoad
          what="The set’s replays"
          retrying={replays.isFetching}
          onRetry={() => void replays.refetch()}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox>
        <EmptyState icon={Play} title="Not replayed yet" action={start}>
          Replay the set’s runs under a candidate, or under the live config to
          take a baseline.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <CardList label="Replays">
        {listed.map((replay) => (
          <ReplayRow
            key={replay.id}
            at={at}
            replay={replay}
            baseline={baseline}
          />
        ))}
      </CardList>
    );
  }

  return (
    <section aria-labelledby="set-replays" className="flex flex-col gap-2">
      <ReplaysHeading
        title="Replays"
        id="set-replays"
        level="h2"
        action={listed.length > 0 ? start : undefined}
      />
      {body}
    </section>
  );
}
