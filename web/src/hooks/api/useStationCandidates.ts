import { useReplayCandidates } from '@/hooks/api/useReplayCandidates';
import { useStation } from '@/hooks/api/useStation';
import { useTeamResource } from '@/hooks/api/useTeamResource';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { type ReplayedStation, stationKeyPath } from '@/lib/replay';

export function useStationCandidates(at: ReplayedStation) {
  const { data: workspace } = useWorkspace(at.slug);
  const team = useTeamResource(at.teamId);
  const { line, station } = useStation(at.teamId, at.lineId, at.stationId);
  const path =
    team.data && line && station
      ? stationKeyPath(team.data.key, line.key, station.key)
      : null;
  const candidates = useReplayCandidates(workspace?.id, path ?? undefined);

  return { path, candidates, pathFailed: team.isError };
}
