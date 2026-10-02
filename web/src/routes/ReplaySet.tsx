import { useParams } from 'react-router';
import { ReplaySetHeader } from '@/components/features/replays/set/ReplaySetHeader';
import { ReplaySetSkeleton } from '@/components/features/replays/set/ReplaySetSkeleton';
import { SetReplays } from '@/components/features/replays/set/SetReplays';
import { SetRuns } from '@/components/features/replays/set/SetRuns';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useTeamReplaySets } from '@/hooks/api/useReplaySets';
import { useReplays } from '@/hooks/api/useReplays';
import { useStationTrail } from '@/hooks/useStationTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { replaySetPath, replaysAnchorPath } from '@/lib/replay';
import { TrailContext, useTrail } from '@/lib/trail';

export function ReplaySet() {
  const { slug, teamId, lineId, stationId, setId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const sets = useTeamReplaySets(teamId);
  const replays = useReplays(teamId, setId);

  const set = sets.data?.find(
    (candidate) =>
      candidate.id === setId &&
      candidate.lineId === lineId &&
      candidate.stationId === stationId,
  );
  const at =
    slug && teamId && lineId && stationId
      ? { slug, teamId, lineId, stationId }
      : null;

  const base: BreadcrumbSegment[] = [
    ...stationTrail,
    ...(set && at ? [{ label: set.name, to: replaySetPath(at, set.id) }] : []),
  ];
  const { trail, forward } = useTrail(base);

  if (loading(sets)) {
    return <ReplaySetSkeleton known={trail} />;
  }

  if (failed(sets)) {
    return (
      <PageNotice>
        {notFound(sets.error) ? (
          <MembersOnly title="Only the team’s members can see its replays" />
        ) : (
          <CouldNotLoad
            what="The replay set"
            retrying={sets.isFetching}
            onRetry={() => void sets.refetch()}
          />
        )}
      </PageNotice>
    );
  }

  if (!set || !at) {
    return (
      <PageNotice title="Replay set not found">
        <p className="text-muted-foreground text-sm">
          There is no replay set at that address. It may have been deleted.
        </p>
      </PageNotice>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout>
        <ReplaySetHeader
          teamId={at.teamId}
          set={set}
          replays={replays.data ?? []}
          deletedTo={replaysAnchorPath(at)}
        />

        <SetReplays at={at} set={set} replays={replays} />

        <SetRuns at={at} set={set} />
      </StationLayout>
    </TrailContext>
  );
}
