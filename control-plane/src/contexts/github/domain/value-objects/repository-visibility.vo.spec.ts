import {
  isFresh,
  VISIBILITY_TTL_MS,
} from '@github/domain/value-objects/repository-visibility.vo';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-01-01T12:00:00Z');

describe('isFresh', () => {
  it('holds inside the time to live', () => {
    expect(
      isFresh(new Date(now.getTime() - 1000), now, VISIBILITY_TTL_MS),
    ).toBe(true);
  });

  it('fails exactly at the time to live', () => {
    expect(
      isFresh(
        new Date(now.getTime() - VISIBILITY_TTL_MS),
        now,
        VISIBILITY_TTL_MS,
      ),
    ).toBe(false);
  });
});
