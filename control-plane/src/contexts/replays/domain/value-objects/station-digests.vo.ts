import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class StationDigests {
  private constructor(
    readonly behaviour: string,
    readonly scoring: string,
  ) {}

  static of(input: { behaviour: string; scoring: string }): StationDigests {
    if (!SHA256_HEX.test(input.behaviour) || !SHA256_HEX.test(input.scoring)) {
      throw new InvalidCandidateError(
        'is digested, how it runs and how it is scored, as SHA-256s in lowercase hex',
      );
    }

    return new StationDigests(input.behaviour, input.scoring);
  }

  runsAs(other: StationDigests): boolean {
    return this.behaviour === other.behaviour;
  }
}
