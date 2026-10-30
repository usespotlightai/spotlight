import { useParams } from 'react-router';
import { StationOverviewSkeleton } from '@/components/features/stations/overview/StationOverviewSkeleton';
import { StationBody } from '@/components/features/stations/StationBody';
import { StationHeading } from '@/components/features/stations/StationHeading';
import { StationPane } from '@/components/features/stations/StationPane';
import { StationSkeleton } from '@/components/features/stations/StationSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStation } from '@/hooks/api/useStation';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { useStationOverviewLoading } from '@/hooks/useStationOverviewLoading';
import { useStationTrail } from '@/hooks/useStationTrail';
import { failed, loading } from '@/lib/query';
import { TrailContext, useTrail } from '@/lib/trail';

export function Station() {
  const { slug, teamId, lineId, stationId } = useParams();
  const { lines, line, station } = useStation(teamId, lineId, stationId);
  const overviewLoading = useStationOverviewLoading({
    teamId,
    lineId,
    stationId,
  });
  const crumbs = useStationTrail({ slug, teamId, lineId, stationId }).slice(
    0,
    -1,
  );
  const { trail, forward } = useTrail(
    station ? [...crumbs, { label: station.name }] : crumbs,
  );

  useScrollToHash(Boolean(station) && !overviewLoading);

  if (loading(lines)) {
    return <StationSkeleton />;
  }

  if (failed(lines)) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The station"
          retrying={lines.isFetching}
          onRetry={() => void lines.refetch()}
        />
      </PageNotice>
    );
  }

  if (!line || !station || !slug || !teamId) {
    return (
      <PageNotice title="Station not found">
        <p className="text-muted-foreground text-sm">
          This line has no station at that address.
        </p>
      </PageNotice>
    );
  }

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} bordered={false} />

      <StationHeading
        slug={slug}
        teamId={teamId}
        line={line}
        station={station}
      />

      <StationPane>
        {overviewLoading && station.kind === 'work' ? (
          <div role="status" aria-label="Loading the station overview">
            <StationOverviewSkeleton />
          </div>
        ) : (
          <StationBody
            slug={slug}
            teamId={teamId}
            line={line}
            station={station}
          />
        )}
      </StationPane>
    </TrailContext>
  );
}
