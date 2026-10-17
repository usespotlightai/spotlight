import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';

const SEPARATOR = '/';

export class CandidateAddress {
  private readonly kind = 'candidate-address';

  private constructor(
    readonly station: StationAddress,
    readonly name: CandidateName,
  ) {}

  static of(station: StationAddress, name: CandidateName): CandidateAddress {
    return new CandidateAddress(station, name);
  }

  static parse(raw: string): CandidateAddress {
    const [teamKey, lineKey, stationKey, name, ...rest] = raw.split(SEPARATOR);
    const station =
      teamKey && lineKey && stationKey
        ? StationAddress.of(teamKey, lineKey, stationKey)
        : null;

    if (!station || name === undefined || rest.length > 0) {
      throw new InvalidCandidateError(
        'address must be team, line and station keys, then name, as in core/delivery/build/Shorter prompt',
      );
    }

    return new CandidateAddress(station, CandidateName.of(name));
  }

  equals(other: CandidateAddress): boolean {
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
