import type { Line } from '@work/domain/aggregates/line.aggregate';
import { NowhereToProposeError } from '@work/domain/exceptions/nowhere-to-propose.error';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';

const keysOf = (named: readonly { key: { value: string } }[]): string =>
  named.map((each) => each.key.value).join(', ') || 'none';

export const proposalPlacementWithin = (
  lines: readonly Line[],
  named: { line: string; station: string },
): ProposalPlacement => {
  const lineNamed = named.line.trim();
  const stationNamed = named.station.trim();
  const line = lines.find((each) => each.key.value === lineNamed);

  if (!line) {
    throw new NowhereToProposeError(
      `there is no line "${lineNamed}"; the lines are: ${keysOf(lines)}`,
    );
  }

  const key = StationKey.parsed(stationNamed);
  const station = key ? line.stationKeyed(key) : null;

  if (!station) {
    throw new NowhereToProposeError(
      `${line.name.value} has no station "${stationNamed}"; its stations are: ${keysOf(line.stations)}`,
    );
  }

  return ProposalPlacement.of({ lineId: line.id, stationId: station.id });
};
