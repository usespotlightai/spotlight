import { useParams } from 'react-router';
import { StationHeading } from '@/components/features/stations/StationHeading';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { StationSkeleton } from '@/components/features/stations/StationSkeleton';
import { WorkStationSections } from '@/components/features/stations/WorkStationSections';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { failed, loading } from '@/lib/query';
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
  const { slug, teamId, lineId, stationId } = useParams();
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
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout>
        <StationHeading
          slug={slug}
          teamId={teamId}
          line={line}
          station={station}
        />

        {station.kind === 'work' ? (
          <WorkStationSections
            slug={slug}
            teamId={teamId}
            line={line}
            station={station}
          />
        ) : (
          <p className="text-muted-foreground text-sm leading-6">
            {ENDS[station.kind]}
          </p>
        )}
      </StationLayout>
    </TrailContext>
  );
}
