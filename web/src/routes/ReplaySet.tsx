import { useParams } from 'react-router';
import { SetHealth } from '@/components/features/replays/set/health/SetHealth';
import { ReplaySetHeader } from '@/components/features/replays/set/ReplaySetHeader';
import { ReplaySetSkeleton } from '@/components/features/replays/set/ReplaySetSkeleton';
import { SetChecks } from '@/components/features/replays/set/SetChecks';
import { SetReplays } from '@/components/features/replays/set/SetReplays';
import { SetRuns } from '@/components/features/replays/set/SetRuns';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useTeamReplaySets } from '@/hooks/api/useReplaySets';
import { useReplays } from '@/hooks/api/useReplays';
import { useSearches } from '@/hooks/api/useSearches';
import { useStation } from '@/hooks/api/useStation';
import { useStationTrail } from '@/hooks/useStationTrail';
import { failed, loading } from '@/lib/query';
import { replaySetPath, replaysAnchorPath } from '@/lib/replay';
import { replayedStationOf } from '@/lib/replayed-station';
import { ongoing } from '@/lib/search';
import { TrailContext, useTrail } from '@/lib/trail';

export function ReplaySet() {
  const { slug, teamId, lineId, stationId, setId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const sets = useTeamReplaySets(teamId);
  const replays = useReplays(teamId, setId);
  const { lines, line, station } = useStation(teamId, lineId, stationId);
  const searches = useSearches(teamId, lineId, stationId);

  const set = sets.data?.find(
    (candidate) =>
      candidate.id === setId &&
      candidate.lineId === lineId &&
      candidate.stationId === stationId,
  );
  const at = replayedStationOf({ slug, teamId, lineId, stationId });

  const searching = Boolean(
    set &&
      searches.data?.some(
        (each) => each.setId === set.id && ongoing(each.state),
      ),
  );

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
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only the team’s members can see its replays"
          what="The replay set"
          query={sets}
        />
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
          replayCheck={line ? line.replayCheck : undefined}
          searching={searching}
        />

        <SetHealth at={at} set={set} live={station ?? null} liveQuery={lines} />

        <SetReplays at={at} set={set} replays={replays} />

        <SetRuns at={at} set={set} frozen={searching} />

        <SetChecks teamId={at.teamId} set={set} />
      </StationLayout>
    </TrailContext>
  );
}
