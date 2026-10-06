import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class StationDigests {
  private constructor(
    readonly behaviour: string,
    readonly scoring: string,
  ) {}

  static of(input: { behaviour: string; scoring: string }): StationDigests {
    if (!SHA256_HEX.test(input.behaviour) || !SHA256_HEX.test(input.scoring)) {
      throw new InvalidCandidateError('digests must be lowercase hex SHA-256s');
    }

    return new StationDigests(input.behaviour, input.scoring);
  }

  runsAs(other: StationDigests): boolean {
    return this.behaviour === other.behaviour;
  }
}
