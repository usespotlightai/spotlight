import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class StationFingerprint {
  private constructor(readonly value: string) {}

  static of(raw: string): StationFingerprint {
    if (!SHA256_HEX.test(raw)) {
      throw new InvalidCandidateError(
        'is fingerprinted as a SHA-256, in lowercase hex',
      );
    }

    return new StationFingerprint(raw);
  }

  equals(other: StationFingerprint): boolean {
    return this.value === other.value;
  }
}
