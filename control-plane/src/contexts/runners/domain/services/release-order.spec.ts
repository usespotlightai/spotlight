import {
  isOlderRelease,
  isSemverRelease,
} from '@runners/domain/services/release-order';
import { describe, expect, it } from 'vitest';

describe('isOlderRelease', () => {
  it('orders releases by major, minor and patch number', () => {
    expect(isOlderRelease('v0.9.0', 'v1.0.0')).toBe(true);
    expect(isOlderRelease('v1.2.9', 'v1.3.0')).toBe(true);
    expect(isOlderRelease('v1.2.2', 'v1.2.10')).toBe(true);
    expect(isOlderRelease('v1.2.10', 'v1.2.2')).toBe(false);
    expect(isOlderRelease('v1.2.2', 'v1.2.2')).toBe(false);
  });

  it('orders a release candidate before its release and after the one before', () => {
    expect(isOlderRelease('v1.0.0-rc.2', 'v1.0.0-rc.10')).toBe(true);
    expect(isOlderRelease('v1.0.0-rc.10', 'v1.0.0')).toBe(true);
    expect(isOlderRelease('v1.0.0', 'v1.0.0-rc.1')).toBe(false);
    expect(isOlderRelease('v1.0.0-rc.1', 'v0.9.9')).toBe(false);
  });

  it('does not call a release it cannot read older', () => {
    expect(isOlderRelease('dev', 'v1.0.0')).toBe(false);
    expect(isOlderRelease('canary', 'v1.0.0')).toBe(false);
    expect(isOlderRelease('20261001-01', 'v1.0.0')).toBe(false);
    expect(isOlderRelease('v0.1.0', 'main')).toBe(false);
  });
});

describe('isSemverRelease', () => {
  it('tells a published release from a staging build', () => {
    expect(isSemverRelease('v1.2.3')).toBe(true);
    expect(isSemverRelease('v1.2.3-rc.1')).toBe(true);
    expect(isSemverRelease('1.2.3')).toBe(false);
    expect(isSemverRelease('3d216a954c1e')).toBe(false);
    expect(isSemverRelease('canary')).toBe(false);
    expect(isSemverRelease('develop')).toBe(false);
    expect(isSemverRelease('dev')).toBe(false);
  });
});
