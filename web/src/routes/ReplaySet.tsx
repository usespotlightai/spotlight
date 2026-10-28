import { useParams } from 'react-router';
import { SetHealth } from '@/components/features/replays/set/health/SetHealth';
import { ReplaySetHeading } from '@/components/features/replays/set/ReplaySetHeading';
import { ReplaySetSkeleton } from '@/components/features/replays/set/ReplaySetSkeleton';
import { SetChecks } from '@/components/features/replays/set/SetChecks';
import { SetReplays } from '@/components/features/replays/set/SetReplays';
import { SetRuns } from '@/components/features/replays/set/SetRuns';
import { StationPane } from '@/components/features/stations/StationPane';
import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useReplaySet } from '@/hooks/api/useReplaySet';
import { useReplays } from '@/hooks/api/useReplays';
import { useSearches } from '@/hooks/api/useSearches';
import { useStation } from '@/hooks/api/useStation';
import { useStationTrail } from '@/hooks/useStationTrail';
import { failed, loading } from '@/lib/query';
import { replayedStationOf } from '@/lib/replayed-station';
import { ongoing } from '@/lib/search';
import { setCrumbs } from '@/lib/station-crumbs';
import { TrailContext, useTrail } from '@/lib/trail';

export function ReplaySet() {
  const { slug, teamId, lineId, stationId, setId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const kept = useReplaySet(teamId, lineId, stationId);
  const replays = useReplays(teamId, setId);
  const { line, station } = useStation(teamId, lineId, stationId);
  const searches = useSearches(teamId, lineId, stationId);

  const set = kept.data && kept.data.id === setId ? kept.data : undefined;
  const at = replayedStationOf({ slug, teamId, lineId, stationId });

  const searching = Boolean(
    set &&
      searches.data?.some(
        (each) => each.setId === set.id && ongoing(each.state),
      ),
  );

  const base: BreadcrumbSegment[] = [...stationTrail, ...setCrumbs(at, set)];
  const { trail, forward } = useTrail(base);

  if (loading(kept)) {
    return <ReplaySetSkeleton known={trail} />;
  }

  if (failed(kept)) {
    return (
      <PageNotice>
        <MembersOnlyOrCouldNotLoad
          membersOnly="Only team members can see its replays"
          what="The replay set"
          query={kept}
        />
      </PageNotice>
    );
  }

  if (!set || !at) {
    return (
      <PageNotice title="Replay set not found">
        <p className="text-muted-foreground text-sm">
          This team has no replay set at that address.
        </p>
      </PageNotice>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} bordered={false} />

      <ReplaySetHeading set={set} line={line} station={station} />

      <StationPane>
        <SetReplays at={at} set={set} replays={replays} />

        <SetHealth at={at} set={set} />

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <SetRuns at={at} set={set} frozen={searching} />
          <SetChecks
            teamId={at.teamId}
            set={set}
            replayCheck={line ? line.replayCheck : undefined}
          />
        </div>
      </StationPane>
    </TrailContext>
  );
}
