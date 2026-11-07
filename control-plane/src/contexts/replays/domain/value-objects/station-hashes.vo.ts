import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { ScoringHash } from '@replays/domain/value-objects/scoring-hash.vo';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class StationHashes {
  private constructor(
    readonly behaviour: string,
    readonly scoring: ScoringHash,
  ) {}

  static of(input: { behaviour: string; scoring: string }): StationHashes {
    if (!SHA256_HEX.test(input.behaviour)) {
      throw new InvalidCandidateError('hashes must be lowercase hex SHA-256s');
    }

    return new StationHashes(input.behaviour, ScoringHash.of(input.scoring));
  }

  runsAs(other: StationHashes): boolean {
    return this.behaviour === other.behaviour;
  }

  scoresAs(other: StationHashes): boolean {
    return this.scoring === other.scoring;
  }
}
