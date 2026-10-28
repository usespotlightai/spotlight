import { Repeat } from 'lucide-react';
import type { ReactNode } from 'react';
import { StateBox } from '@/components/features/replays/StateBox';
import { ReplaySetRow } from '@/components/features/replays/station/ReplaySetRow';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { useReplaySet } from '@/hooks/api/useReplaySet';
import { failed, loading } from '@/lib/query';
import { REPLAY_SET_HEADINGS, type ReplayedStation } from '@/lib/replay';

type ReplaySetsProps = {
  at: ReplayedStation;
};

export function ReplaySets({ at }: ReplaySetsProps) {
  const kept = useReplaySet(at.teamId, at.lineId, at.stationId);

  let body: ReactNode;

  if (loading(kept)) {
    body = (
      <NestedTableSkeleton
        label="Loading the replay set"
        headings={REPLAY_SET_HEADINGS}
        compact
      />
    );
  } else if (failed(kept)) {
    body = (
      <StateBox flat>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its replays"
          what="The station’s replay set"
          query={kept}
        />
      </StateBox>
    );
  } else if (!kept.data) {
    body = (
      <StateBox flat>
        <EmptyState icon={Repeat} title="No replay set yet">
          Spotlight keeps a replay set after a run of the station ends.
        </EmptyState>
      </StateBox>
    );
  } else {
    body = (
      <NestedTable label="Replay set" headings={REPLAY_SET_HEADINGS} compact>
        <ReplaySetRow at={at} set={kept.data} />
      </NestedTable>
    );
  }

  return body;
}
