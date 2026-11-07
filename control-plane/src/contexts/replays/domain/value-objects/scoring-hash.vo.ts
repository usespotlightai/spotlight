import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type ScoringHash = string & { readonly brand: 'scoring-hash' };

export const ScoringHash = {
  of(raw: string): ScoringHash {
    if (!SHA256_HEX.test(raw)) {
      throw new InvalidCandidateError(
        'scoring hash must be a lowercase hex SHA-256',
      );
    }

    return raw as ScoringHash;
  },
};
