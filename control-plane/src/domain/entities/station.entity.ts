import type { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

/** Position orders the board. It does not define the flow: movement becomes
 *  explicit transitions once runs execute, because review sends work back. */
export class Station {
  private constructor(
    readonly id: StationId,
    readonly name: StationName,
    readonly position: number,
  ) {}

  static create(input: {
    id: StationId;
    name: StationName;
    position: number;
  }): Station {
    return new Station(input.id, input.name, input.position);
  }

  equals(other: Station): boolean {
    return this.id.equals(other.id);
  }
}
