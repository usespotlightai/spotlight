import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class StationHashes {
  private constructor(
    readonly behaviour: string,
    readonly scoring: string,
  ) {}

  static of(input: { behaviour: string; scoring: string }): StationHashes {
    if (!SHA256_HEX.test(input.behaviour) || !SHA256_HEX.test(input.scoring)) {
      throw new InvalidCandidateError('hashes must be lowercase hex SHA-256s');
    }

    return new StationHashes(input.behaviour, input.scoring);
  }

  runsAs(other: StationHashes): boolean {
    return this.behaviour === other.behaviour;
  }
}
