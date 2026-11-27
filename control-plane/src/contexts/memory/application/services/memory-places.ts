import type { TeamLine } from '@memory/application/ports/lines.port';
import type { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';

/** Where a memory or a proposal applies, in words a model reads: the whole team, a line or a station, and a repository. */
export const placeOf = (
  scope: MemoryScope,
  lines: readonly TeamLine[],
): string => {
  const { lineId, stationId, repository } = scope;
  const line = lines.find((each) => lineId !== null && each.id.equals(lineId));
  const station = line?.stations.find(
    (each) => stationId !== null && each.id.equals(stationId),
  );
  const at = station
    ? `the station "${station.name}" of the line "${line?.name}"`
    : line
      ? `the line "${line.name}"`
      : 'the whole team';

  return repository ? `${at}, about the repository ${repository.value}` : at;
};
