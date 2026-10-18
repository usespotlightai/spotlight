import {
  isDatedRelease,
  isOlderRelease,
} from '@runners/domain/services/release-order';
import { describe, expect, it } from 'vitest';

describe('isOlderRelease', () => {
  it('orders dated releases by day, then by number', () => {
    expect(isOlderRelease('20261001-09', '20261002-01')).toBe(true);
    expect(isOlderRelease('20261002-02', '20261002-10')).toBe(true);
    expect(isOlderRelease('20261002-10', '20261002-02')).toBe(false);
    expect(isOlderRelease('20261002-02', '20261002-02')).toBe(false);
  });

  it('does not call a release it cannot read older', () => {
    expect(isOlderRelease('dev', '20261002-02')).toBe(false);
    expect(isOlderRelease('20261001-01', 'main')).toBe(false);
  });
});

describe('isDatedRelease', () => {
  it('tells a published release from a staging build', () => {
    expect(isDatedRelease('20261018-01')).toBe(true);
    expect(isDatedRelease('3d216a954c1e')).toBe(false);
    expect(isDatedRelease('develop')).toBe(false);
    expect(isDatedRelease('dev')).toBe(false);
  });
});
