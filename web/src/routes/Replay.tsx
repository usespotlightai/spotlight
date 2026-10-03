import { useParams } from 'react-router';
import { ReplayPage } from '@/components/features/replays/replay/ReplayPage';
import { ReplaySkeleton } from '@/components/features/replays/replay/ReplaySkeleton';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { useReplay } from '@/hooks/api/useReplay';
import { useTeamReplaySets } from '@/hooks/api/useReplaySets';
import { useReplays } from '@/hooks/api/useReplays';
import { useStationTrail } from '@/hooks/useStationTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import { replayedStationOf } from '@/lib/replayed-station';
import { replayCrumbs } from '@/lib/station-crumbs';
import { useTrail } from '@/lib/trail';

export function Replay() {
  const { slug, teamId, lineId, stationId, replayId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const replay = useReplay(teamId, replayId);
  const sets = useTeamReplaySets(teamId);
  const siblings = useReplays(teamId, replay.data?.setId);

  const found = replay.data;
  const at = replayedStationOf({ slug, teamId, lineId, stationId });
  const set = sets.data?.find(
    (candidate) =>
      candidate.id === found?.setId &&
      candidate.lineId === lineId &&
      candidate.stationId === stationId,
  );
  const { trail, forward } = useTrail([
    ...stationTrail,
    ...replayCrumbs(at, set, found),
  ]);

  if (loading(replay) || loading(sets)) {
    return <ReplaySkeleton known={trail} />;
  }

  if (failed(replay) && !(notFound(replay.error) && sets.data)) {
    return (
      <PageNotice>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only the team’s members can see its replays"
          what="The replay"
          query={replay}
        />
      </PageNotice>
    );
  }

  if (!found || !set || !at) {
    return (
      <PageNotice title="Replay not found">
        <p className="text-muted-foreground text-sm">
          There is no replay at that address.
        </p>
      </PageNotice>
    );
  }

  return (
    <ReplayPage
      at={at}
      replay={found}
      set={set}
      siblings={siblings.data ?? []}
      trail={trail}
      forward={forward}
    />
  );
}
