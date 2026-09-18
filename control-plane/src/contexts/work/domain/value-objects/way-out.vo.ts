import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class WayOut {
  private constructor(
    readonly stations: readonly StationId[],
    readonly ends: boolean,
  ) {}

  static of(input: {
    stations?: readonly StationId[];
    ends?: boolean;
  }): WayOut {
    return new WayOut([...(input.stations ?? [])], input.ends ?? false);
  }

  static nowhere(): WayOut {
    return new WayOut([], false);
  }

  leadsTo(stationId: StationId): boolean {
    return this.stations.some((each) => each.equals(stationId));
  }

  equals(other: WayOut): boolean {
    return (
      this.ends === other.ends &&
      this.stations.length === other.stations.length &&
      this.stations.every((each, index) => each.equals(other.stations[index]))
    );
  }
}
