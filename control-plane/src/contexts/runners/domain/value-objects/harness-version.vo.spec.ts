import { InvalidHarnessVersionError } from '@runners/domain/exceptions/invalid-harness-version.error';
import { HarnessVersion } from '@runners/domain/value-objects/harness-version.vo';
import { describe, expect, it } from 'vitest';

describe('HarnessVersion', () => {
  it('takes a release without its leading v', () => {
    expect(HarnessVersion.of(' v2.1.270 ').value).toBe('2.1.270');
    expect(HarnessVersion.of('2026.09.01-abc').value).toBe('2026.09.01-abc');
  });

  it('refuses what is not a release', () => {
    expect(() => HarnessVersion.of('latest')).toThrow(
      InvalidHarnessVersionError,
    );
    expect(() => HarnessVersion.of('')).toThrow(InvalidHarnessVersionError);
  });

  it('reads nothing from a report it cannot make sense of', () => {
    expect(HarnessVersion.reported('garbage')).toBeNull();
    expect(HarnessVersion.reported(undefined)).toBeNull();
    expect(HarnessVersion.reported('1.4.0')?.value).toBe('1.4.0');
  });

  it('is the same release as one written the same way', () => {
    expect(HarnessVersion.of('v1.0').equals(HarnessVersion.of('1.0'))).toBe(
      true,
    );
  });
});
