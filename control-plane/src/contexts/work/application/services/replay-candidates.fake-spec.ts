import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { stationWith } from '@work/domain/value-objects/line-map.fake-spec';
import { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { StationInput } from '@work/domain/value-objects/station.vo';

export type CandidateChange = Omit<Partial<StationInput>, 'id'>;

export const candidateOf = (
  line: LineMap,
  stationId: StationId,
  changed: CandidateChange,
): LineMap => {
  const current = line.stationAt(stationId);

  if (!current) {
    throw new Error(`the line has no station ${stationId.value}`);
  }

  const candidate = stationWith(current, changed);

  return LineMap.of({
    id: line.id,
    workspaceId: line.workspaceId,
    teamId: line.teamId,
    key: line.key,
    name: line.name,
    stations: line.stations.map((each) =>
      each.id.equals(stationId) ? candidate : each,
    ),
    reactions: line.reactions,
    role: line.role,
    repositories: line.repositories,
    reviews: line.reviews,
    placement: line.placement,
    replayCheck: line.replayCheck,
    source: line.source,
  });
};
