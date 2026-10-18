import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class StationRoutes {
  private constructor(
    readonly stations: readonly StationId[],
    readonly ends: boolean,
  ) {}

  static of(input: {
    stations?: readonly StationId[];
    ends?: boolean;
  }): StationRoutes {
    return new StationRoutes([...(input.stations ?? [])], input.ends ?? false);
  }

  static none(): StationRoutes {
    return new StationRoutes([], false);
  }

  routesTo(stationId: StationId): boolean {
    return this.stations.some((each) => each.equals(stationId));
  }

  equals(other: StationRoutes): boolean {
    return (
      this.ends === other.ends &&
      this.stations.length === other.stations.length &&
      this.stations.every((each, index) => each.equals(other.stations[index]))
    );
  }
}
