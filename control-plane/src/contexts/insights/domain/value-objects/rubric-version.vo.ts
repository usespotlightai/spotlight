import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';

const SHA_256 = /^[0-9a-f]{64}$/;

export type RubricVersion = string & { readonly brand: 'rubric-version' };

export const RubricVersion = {
  of(raw: string): RubricVersion {
    if (!SHA_256.test(raw)) {
      throw new InvalidFingerprintError('rubric version');
    }

    return raw as RubricVersion;
  },

  optional(raw: string | null): RubricVersion | null {
    return raw === null ? null : RubricVersion.of(raw);
  },

  readable(raw: string): RubricVersion | null {
    return SHA_256.test(raw) ? (raw as RubricVersion) : null;
  },
};
