import { useParams } from 'react-router';
import { StationConfigTab } from '@/components/features/stations/config/StationConfigTab';
import { StationImproveTab } from '@/components/features/stations/improve/StationImproveTab';
import { StationOverviewTab } from '@/components/features/stations/overview/StationOverviewTab';
import { StationHeading } from '@/components/features/stations/StationHeading';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { StationSkeleton } from '@/components/features/stations/StationSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { failed, loading } from '@/lib/query';
import { stationTab } from '@/lib/station';
import { linePath } from '@/lib/team';
import { teamCrumb } from '@/lib/team-crumb';
import { TrailContext, useTrail } from '@/lib/trail';

const ENDS = {
  backlog:
    'Tasks wait here until someone starts them. Nothing runs at a backlog, so it has no harness and nothing to instruct.',
  completed:
    'Tasks land here once the line is done with them. Nothing runs at it.',
};

export function Station() {
  const { slug, teamId, lineId, stationId, tab: shown } = useParams();
  const tab = stationTab(shown);
  const { data: workspace } = useWorkspace(slug);
  const { lines, line, station } = useStation(teamId, lineId, stationId);

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const { trail, forward } = useTrail([
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    ...(line && slug && teamId
      ? [{ label: line.name, to: linePath(slug, teamId, line.id) }]
      : []),
    ...(station ? [{ label: station.name }] : []),
  ]);

  useScrollToHash(Boolean(station));

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
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout>
        <StationHeading
          slug={slug}
          teamId={teamId}
          line={line}
          station={station}
          tab={tab}
        />

        {station.kind !== 'work' ? (
          <p className="text-muted-foreground text-sm leading-6">
            {ENDS[station.kind]}
          </p>
        ) : tab === 'overview' ? (
          <StationOverviewTab
            slug={slug}
            teamId={teamId}
            lineId={line.id}
            station={station}
          />
        ) : tab === 'improve' ? (
          <StationImproveTab
            slug={slug}
            teamId={teamId}
            line={line}
            station={station}
          />
        ) : (
          <StationConfigTab
            slug={slug}
            teamId={teamId}
            line={line}
            station={station}
          />
        )}
      </StationLayout>
    </TrailContext>
  );
}
