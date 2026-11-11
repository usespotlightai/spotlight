import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { describe, expect, it } from 'vitest';

describe('fingerprints', () => {
  it('names a station config by its 64-character hex SHA-256', () => {
    expect(ConfigFingerprint.of('a'.repeat(64))).toBe('a'.repeat(64));
    expect(() => ConfigFingerprint.of('A'.repeat(64))).toThrow(
      InvalidFingerprintError,
    );
    expect(ConfigFingerprint.readable('nope')).toBeNull();
    expect(ConfigFingerprint.optional(null)).toBeNull();
  });

  it('names a rubric version by its 64-character hex SHA-256', () => {
    expect(RubricVersion.of('b'.repeat(64))).toBe('b'.repeat(64));
    expect(() => RubricVersion.of('b'.repeat(63))).toThrow(
      InvalidFingerprintError,
    );
    expect(RubricVersion.readable('b')).toBeNull();
  });
});
