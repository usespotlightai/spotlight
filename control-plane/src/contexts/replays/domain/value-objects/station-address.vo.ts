import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

export class StationAddress {
  private readonly kind = 'station-address';

  private constructor(
    readonly teamKey: string,
    readonly lineKey: string,
    readonly stationKey: string,
  ) {}

  static of(
    teamKey: string,
    lineKey: string,
    stationKey: string,
  ): StationAddress | null {
    return isSlug(teamKey) && isSlug(lineKey) && isSlug(stationKey)
      ? new StationAddress(teamKey, lineKey, stationKey)
      : null;
  }

  static parsed(held: string): StationAddress | null {
    const [teamKey, lineKey, stationKey, ...rest] = held
      .trim()
      .split(SEPARATOR);

    return teamKey && lineKey && stationKey && rest.length === 0
      ? StationAddress.of(teamKey, lineKey, stationKey)
      : null;
  }

  equals(other: StationAddress): boolean {
    return (
      this.kind === other.kind &&
      this.teamKey === other.teamKey &&
      this.lineKey === other.lineKey &&
      this.stationKey === other.stationKey
    );
  }

  toString(): string {
    return [this.teamKey, this.lineKey, this.stationKey].join(SEPARATOR);
  }
}
