import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { stationPath } from '@/lib/station';
import { linePath } from '@/lib/team';
import { teamCrumb } from '@/lib/team-crumb';

type StationParams = {
  readonly slug?: string;
  readonly teamId?: string;
  readonly lineId?: string;
  readonly stationId?: string;
};

export function useStationTrail({
  slug,
  teamId,
  lineId,
  stationId,
}: StationParams): BreadcrumbSegment[] {
  const { data: workspace } = useWorkspace(slug);
  const { line, station } = useStation(teamId, lineId, stationId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return [
    ...(team && slug ? [teamCrumb(slug, team)] : []),
    ...(line && slug && teamId
      ? [{ label: line.name, to: linePath(slug, teamId, line.id) }]
      : []),
    ...(slug && teamId && lineId && stationId
      ? [
          {
            label: station?.name ?? 'Removed station',
            to: station
              ? stationPath(slug, teamId, lineId, stationId)
              : undefined,
          },
        ]
      : []),
  ];
}
