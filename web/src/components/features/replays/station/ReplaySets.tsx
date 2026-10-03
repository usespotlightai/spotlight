import { Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import { CardList } from '@/components/features/replays/CardList';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { OpenReplaySetButton } from '@/components/features/replays/station/OpenReplaySetButton';
import { ReplaySetRow } from '@/components/features/replays/station/ReplaySetRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { failed, loading } from '@/lib/query';
import type { ReplayedStation } from '@/lib/replay';

type ReplaySetsProps = {
  at: ReplayedStation;
};

export function ReplaySets({ at }: ReplaySetsProps) {
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);
  const listed = sets.data ?? [];
  const open = <OpenReplaySetButton at={at} />;
  const shown = !loading(sets) && !failed(sets) && listed.length > 0;

  let body: ReactNode;

  if (loading(sets)) {
    body = <RowsSkeleton label="Loading the replay sets" />;
  } else if (failed(sets)) {
    body = (
      <StateBox>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only the team’s members can see its replays"
          what="The station’s replay sets"
          query={sets}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox>
        <EmptyState icon={Repeat} title="No replay sets yet" action={open}>
          A replay set holds a few of the station’s past runs, to replay under a
          candidate and compare.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <CardList label="Replay sets">
        {listed.map((set) => (
          <ReplaySetRow key={set.id} at={at} set={set} />
        ))}
      </CardList>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ReplaysHeading title="Replay sets" action={shown ? open : undefined} />
      {body}
    </div>
  );
}
