import { InvalidReleaseError } from '@shared-kernel/domain/exceptions/invalid-release.error';
import { Release } from '@shared-kernel/domain/value-objects/release.vo';
import { describe, expect, it } from 'vitest';

const older = (release: string, than: string): boolean =>
  Release.of(release).isOlderThan(Release.of(than));

describe('Release', () => {
  it('orders releases by major, minor and patch number', () => {
    expect(older('v0.9.0', 'v1.0.0')).toBe(true);
    expect(older('v1.2.9', 'v1.3.0')).toBe(true);
    expect(older('v1.2.2', 'v1.2.10')).toBe(true);
    expect(older('v1.2.10', 'v1.2.2')).toBe(false);
    expect(older('v1.2.2', 'v1.2.2')).toBe(false);
  });

  it('orders a release candidate before its release and after the one before', () => {
    expect(older('v1.0.0-rc.2', 'v1.0.0-rc.10')).toBe(true);
    expect(older('v1.0.0-rc.10', 'v1.0.0')).toBe(true);
    expect(older('v1.0.0', 'v1.0.0-rc.1')).toBe(false);
    expect(older('v1.0.0-rc.1', 'v0.9.9')).toBe(false);
  });

  it('refuses a release that is not a published release', () => {
    for (const raw of [
      '1.2.3',
      'v01.2.3',
      'v1.2.3-rc.01',
      'v1.2.3-beta.1',
      'v1.2',
      '20261001-01',
      'canary',
    ]) {
      expect(() => Release.of(raw)).toThrow(InvalidReleaseError);
    }
  });

  it('tells a published release from a staging build', () => {
    expect(Release.published('v1.2.3')?.value).toBe('v1.2.3');
    expect(Release.published('v1.2.3-rc.1')?.value).toBe('v1.2.3-rc.1');
    expect(Release.published('3d216a954c1e')).toBeNull();
    expect(Release.published('canary')).toBeNull();
    expect(Release.published('dev')).toBeNull();
    expect(Release.published(null)).toBeNull();
  });
});
