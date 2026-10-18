import { isSlug } from '@shared-kernel/domain/value-objects/identifier-shapes';

const SEPARATOR = '/';

export class StationPath {
  private readonly kind = 'station-path';

  private constructor(
    readonly teamKey: string,
    readonly lineKey: string,
    readonly stationKey: string,
  ) {}

  static of(
    teamKey: string,
    lineKey: string,
    stationKey: string,
  ): StationPath | null {
    return isSlug(teamKey) && isSlug(lineKey) && isSlug(stationKey)
      ? new StationPath(teamKey, lineKey, stationKey)
      : null;
  }

  static parsed(raw: string): StationPath | null {
    const [teamKey, lineKey, stationKey, ...rest] = raw.trim().split(SEPARATOR);

    return teamKey && lineKey && stationKey && rest.length === 0
      ? StationPath.of(teamKey, lineKey, stationKey)
      : null;
  }

  equals(other: StationPath): boolean {
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
