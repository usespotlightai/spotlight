import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';

const SHA_256 = /^[0-9a-f]{64}$/;

export type RubricVersion = string & { readonly brand: 'rubric-version' };

const isRubricVersion = (raw: string): raw is RubricVersion =>
  SHA_256.test(raw);

export const RubricVersion = {
  of(raw: string): RubricVersion {
    if (!isRubricVersion(raw)) {
      throw new InvalidFingerprintError('rubric version');
    }

    return raw;
  },

  optional(raw: string | null): RubricVersion | null {
    return raw === null ? null : RubricVersion.of(raw);
  },

  readable(raw: string): RubricVersion | null {
    return isRubricVersion(raw) ? raw : null;
  },
};
