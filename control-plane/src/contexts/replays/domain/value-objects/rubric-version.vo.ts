import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export type RubricVersion = string & { readonly brand: 'rubric-version' };

export const RubricVersion = {
  of(raw: string): RubricVersion {
    if (!SHA256_HEX.test(raw)) {
      throw new InvalidCandidateError(
        'rubric version must be a lowercase hex SHA-256',
      );
    }

    return raw as RubricVersion;
  },

  optional(raw: string | null): RubricVersion | null {
    return raw === null ? null : RubricVersion.of(raw);
  },
};
