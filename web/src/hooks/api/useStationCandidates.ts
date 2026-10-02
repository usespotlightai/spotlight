import { useReplayCandidates } from '@/hooks/api/useReplayCandidates';
import { useStation } from '@/hooks/api/useStation';
import { useTeamResource } from '@/hooks/api/useTeamResource';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { type ReplayedStation, stationAddress } from '@/lib/replay';

export function useStationCandidates(at: ReplayedStation) {
  const { data: workspace } = useWorkspace(at.slug);
  const team = useTeamResource(at.teamId);
  const { line, station } = useStation(at.teamId, at.lineId, at.stationId);
  const address =
    team.data && line && station
      ? stationAddress(team.data.key, line.key, station.key)
      : null;
  const candidates = useReplayCandidates(workspace?.id, address ?? undefined);

  return { address, candidates, addressFailed: team.isError };
}
