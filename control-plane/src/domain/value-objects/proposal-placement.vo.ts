import type { Line } from '@domain/aggregates/line.aggregate';
import { NowhereToProposeError } from '@domain/exceptions/nowhere-to-propose.error';
import type { LineId } from '@domain/value-objects/line-id.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

const keysOf = (named: readonly { key: { value: string } }[]): string =>
  named.map((each) => each.key.value).join(', ') || 'none';

export class ProposalPlacement {
  private constructor(
    readonly lineId: LineId,
    readonly stationId: StationId,
  ) {}

  static within(
    lines: readonly Line[],
    lineKey: string,
    stationKey: string,
  ): ProposalPlacement {
    const lineNamed = lineKey.trim();
    const stationNamed = stationKey.trim();
    const line = lines.find((each) => each.key.value === lineNamed);

    if (!line) {
      throw new NowhereToProposeError(
        `there is no line "${lineNamed}"; the lines are: ${keysOf(lines)}`,
      );
    }

    const station = line.stations.find(
      (each) => each.key.value === stationNamed,
    );

    if (!station) {
      throw new NowhereToProposeError(
        `${line.name.value} has no station "${stationNamed}"; its stations are: ${keysOf(line.stations)}`,
      );
    }

    return new ProposalPlacement(line.id, station.id);
  }

  static rehydrate(input: {
    lineId: LineId;
    stationId: StationId;
  }): ProposalPlacement {
    return new ProposalPlacement(input.lineId, input.stationId);
  }

  equals(other: ProposalPlacement): boolean {
    return (
      this.lineId.equals(other.lineId) && this.stationId.equals(other.stationId)
    );
  }
}
