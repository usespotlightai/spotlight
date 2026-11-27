import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';

const SHA_256 = /^[0-9a-f]{64}$/;

export type ConfigFingerprint = string & {
  readonly brand: 'config-fingerprint';
};

const isConfigFingerprint = (raw: string): raw is ConfigFingerprint =>
  SHA_256.test(raw);

export const ConfigFingerprint = {
  of(raw: string): ConfigFingerprint {
    if (!isConfigFingerprint(raw)) {
      throw new InvalidFingerprintError('station config fingerprint');
    }

    return raw;
  },

  optional(raw: string | null): ConfigFingerprint | null {
    return raw === null ? null : ConfigFingerprint.of(raw);
  },

  readable(raw: string | null): ConfigFingerprint | null {
    return raw !== null && isConfigFingerprint(raw) ? raw : null;
  },
};
