import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { since } from '@/lib/since';

const NOW = new Date('2026-08-30T12:00:00.000Z');

describe('since', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('reads as just now within the minute', () => {
    expect(since('2026-08-30T11:59:30.000Z')).toBe('just now');
  });

  it('counts minutes within the hour', () => {
    expect(since('2026-08-30T11:18:00.000Z')).toBe('42m ago');
  });

  it('counts hours within the day', () => {
    expect(since('2026-08-30T04:00:00.000Z')).toBe('8h ago');
  });

  it('gives a date once it is older than a day', () => {
    expect(since('2026-08-20T09:00:00.000Z')).toMatch(/Aug/);
  });
});
