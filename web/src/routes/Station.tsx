import { useParams } from 'react-router';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { StationReplays } from '@/components/features/replays/station/StationReplays';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { StationOutcomes } from '@/components/features/stations/outcomes/StationOutcomes';
import { StationAlerts } from '@/components/features/stations/StationAlerts';
import { StationJudge } from '@/components/features/stations/StationJudge';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { StationPrompt } from '@/components/features/stations/StationPrompt';
import { StationSkeleton } from '@/components/features/stations/StationSkeleton';
import { StationSkills } from '@/components/features/stations/StationSkills';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { failed, loading } from '@/lib/query';
import { stationShare } from '@/lib/station';
import { linePath, teamPath } from '@/lib/team';
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

  const base: BreadcrumbSegment[] = [
    ...(team
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: slug && teamId ? teamPath(slug, teamId) : undefined,
          },
        ]
      : []),
    ...(line
      ? [
          {
            label: line.name,
            to:
              slug && teamId && lineId
                ? linePath(slug, teamId, lineId)
                : undefined,
          },
        ]
      : []),
    ...(station ? [{ label: station.name }] : []),
  ];
  const { trail, forward } = useTrail(base);

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
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 p-0.5">
              <StationIcon
                share={stationShare(
                  line.stations.findIndex((each) => each.id === station.id),
                  line.stations.length,
                )}
                color={station.color}
                className="size-5"
              />
            </span>

            <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
              {station.name}
            </h1>

            {station.kind === 'work' && (
              <ImproveStationLink
                slug={slug}
                teamId={teamId}
                improving={{
                  lineId: line.id,
                  lineKey: line.key,
                  lineName: line.name,
                  stationId: station.id,
                  stationKey: station.key,
                  stationName: station.name,
                }}
                className="ml-auto"
              />
            )}
          </div>

          {station.description && (
            <p className="text-foreground text-sm leading-6">
              {station.description}
            </p>
          )}

          {station.kind === 'work' && (
            <div className="-ml-2 flex flex-wrap items-center gap-2">
              <FixedSettings
                slug={slug}
                harness={station.harness}
                model={station.model}
                effort={station.effort}
                repositories={line.repositories}
              />
            </div>
          )}
        </div>

        {station.kind === 'work' ? (
          <>
            <StationPrompt
              stationId={station.id}
              prompt={station.agentPrompt}
            />

            <StationSkills skills={station.skills} />

            {station.judge && (
              <StationJudge
                slug={slug}
                teamId={teamId}
                lineId={line.id}
                stationId={station.id}
                judge={station.judge}
              />
            )}

            {station.alerts.length > 0 && (
              <StationAlerts alerts={station.alerts} />
            )}

            <StationOutcomes
              slug={slug}
              teamId={teamId}
              lineId={line.id}
              stationId={station.id}
            />

            <StationReplays
              at={{ slug, teamId, lineId: line.id, stationId: station.id }}
              lineKey={line.key}
              stationKey={station.key}
            />
          </>
        ) : (
          <p className="text-muted-foreground text-sm leading-6">
            {ENDS[station.kind]}
          </p>
        )}
      </StationLayout>
    </TrailContext>
  );
}
