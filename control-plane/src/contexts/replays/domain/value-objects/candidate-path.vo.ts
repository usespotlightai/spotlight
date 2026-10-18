import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';

const SEPARATOR = '/';

export class CandidatePath {
  private readonly kind = 'candidate-path';

  private constructor(
    readonly station: StationPath,
    readonly name: CandidateName,
  ) {}

  static of(station: StationPath, name: CandidateName): CandidatePath {
    return new CandidatePath(station, name);
  }

  static parse(raw: string): CandidatePath {
    const [teamKey, lineKey, stationKey, name, ...rest] = raw.split(SEPARATOR);
    const station =
      teamKey && lineKey && stationKey
        ? StationPath.of(teamKey, lineKey, stationKey)
        : null;

    if (!station || name === undefined || rest.length > 0) {
      throw new InvalidCandidateError(
        'address must be team, line and station keys, then name, as in core/delivery/build/Shorter prompt',
      );
    }

    return new CandidatePath(station, CandidateName.of(name));
  }

  equals(other: CandidatePath): boolean {
    return (
      this.kind === other.kind &&
      this.station.equals(other.station) &&
      this.name.equals(other.name)
    );
  }

  toString(): string {
    return [this.station.toString(), this.name.value].join(SEPARATOR);
  }
}
