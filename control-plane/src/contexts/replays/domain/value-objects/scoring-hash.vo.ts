import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type ScoringHash = string & { readonly brand: 'scoring-hash' };

const isScoringHash = (raw: string): raw is ScoringHash => SHA256_HEX.test(raw);

export const ScoringHash = {
  of(raw: string): ScoringHash {
    if (!isScoringHash(raw)) {
      throw new InvalidCandidateError(
        'scoring hash must be a lowercase hex SHA-256',
      );
    }

    return raw;
  },
};
