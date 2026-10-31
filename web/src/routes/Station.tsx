import { useParams } from 'react-router';
import { StationBody } from '@/components/features/stations/StationBody';
import { StationHeading } from '@/components/features/stations/StationHeading';
import { StationPane } from '@/components/features/stations/StationPane';
import { StationSkeleton } from '@/components/features/stations/StationSkeleton';
import { StationTabSkeleton } from '@/components/features/stations/StationTabSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStation } from '@/hooks/api/useStation';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { useStationTabLoading } from '@/hooks/useStationTabLoading';
import { useStationTrail } from '@/hooks/useStationTrail';
import { failed, loading } from '@/lib/query';
import { stationTab } from '@/lib/station';
import { TrailContext, useTrail } from '@/lib/trail';

export function Station() {
  const { slug, teamId, lineId, stationId, tab: shown } = useParams();
  const tab = stationTab(shown);
  const { lines, line, station } = useStation(teamId, lineId, stationId);
  const tabLoading = useStationTabLoading(tab, { teamId, lineId, stationId });
  const crumbs = useStationTrail({ slug, teamId, lineId, stationId }).slice(
    0,
    -1,
  );
  const { trail, forward } = useTrail(
    station ? [...crumbs, { label: station.name }] : crumbs,
  );

  useScrollToHash(Boolean(station) && !tabLoading);

  if (loading(lines)) {
    return <StationSkeleton tab={tab ?? 'overview'} />;
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

  if (!line || !station || !slug || !teamId || !tab) {
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
        tab={tab}
      />

      <StationPane>
        {tabLoading && station.kind === 'work' ? (
          <StationTabSkeleton tab={tab} />
        ) : (
          <StationBody
            slug={slug}
            teamId={teamId}
            line={line}
            station={station}
            tab={tab}
          />
        )}
      </StationPane>
    </TrailContext>
  );
}
