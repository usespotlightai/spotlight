import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export const isStationFingerprint = (raw: string): boolean =>
  SHA256_HEX.test(raw);

export class StationFingerprint {
  private constructor(readonly value: string) {}

  static of(raw: string): StationFingerprint {
    if (!isStationFingerprint(raw)) {
      throw new InvalidCandidateError(
        'fingerprint must be a lowercase hex SHA-256',
      );
    }

    return new StationFingerprint(raw);
  }

  equals(other: StationFingerprint): boolean {
    return this.value === other.value;
  }
}
