import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';

const SHA_256 = /^[0-9a-f]{64}$/;

export type ConfigFingerprint = string & {
  readonly brand: 'config-fingerprint';
};

export const ConfigFingerprint = {
  of(raw: string): ConfigFingerprint {
    if (!SHA_256.test(raw)) {
      throw new InvalidFingerprintError('station config fingerprint');
    }

    return raw as ConfigFingerprint;
  },

  optional(raw: string | null): ConfigFingerprint | null {
    return raw === null ? null : ConfigFingerprint.of(raw);
  },

  readable(raw: string | null): ConfigFingerprint | null {
    return raw !== null && SHA_256.test(raw)
      ? (raw as ConfigFingerprint)
      : null;
  },
};
