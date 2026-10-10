import { Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateBox } from '@/components/features/replays/StateBox';
import { OpenReplaySetButton } from '@/components/features/replays/station/OpenReplaySetButton';
import { ReplaySetRow } from '@/components/features/replays/station/ReplaySetRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { useReplaySets } from '@/hooks/api/useReplaySets';
import { failed, loading } from '@/lib/query';
import { REPLAY_SET_HEADINGS, type ReplayedStation } from '@/lib/replay';

type ReplaySetsProps = {
  at: ReplayedStation;
};

export function ReplaySets({ at }: ReplaySetsProps) {
  const sets = useReplaySets(at.teamId, at.lineId, at.stationId);
  const listed = sets.data ?? [];
  const open = <OpenReplaySetButton at={at} />;

  let body: ReactNode;

  if (loading(sets)) {
    body = (
      <NestedTableSkeleton
        label="Loading the replay sets"
        headings={REPLAY_SET_HEADINGS}
        compact
      />
    );
  } else if (failed(sets)) {
    body = (
      <StateBox flat>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its replays"
          what="The station’s replay sets"
          query={sets}
        />
      </StateBox>
    );
  } else if (listed.length === 0) {
    body = (
      <StateBox flat>
        <EmptyState icon={Repeat} title="No replay sets yet" action={open}>
          A replay set holds past runs to replay under a candidate. Create one
          to start comparing.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <NestedTable label="Replay sets" headings={REPLAY_SET_HEADINGS} compact>
        {listed.map((set) => (
          <ReplaySetRow key={set.id} at={at} set={set} />
        ))}
      </NestedTable>
    );
  }

  return body;
}
