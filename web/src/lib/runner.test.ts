import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seenAt, since, withActivity } from '@/lib/runner';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const runner = (over: Record<string, unknown> = {}) =>
  ({
    id: 'runner_1',
    name: 'Laptop',
    harnesses: [],
    registeredAt: '2026-08-20T09:00:00.000Z',
    lastSeenAt: '2026-08-30T11:30:00.000Z',
    revokedAt: null,
    connected: true,
    currentRun: null,
    ...over,
  }) as Parameters<typeof seenAt>[0];

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

describe('seenAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('says when a runner was last heard from', () => {
    expect(seenAt(runner())).toBe('Last seen 30m ago');
  });

  it('falls back to when it was registered, having never answered', () => {
    expect(seenAt(runner({ lastSeenAt: null }))).toMatch(/^Registered /);
  });
});

describe('withActivity', () => {
  it('pairs each runner with the run it holds, and leaves the rest idle', () => {
    const [busy, idle] = withActivity(
      [runner({ id: 'runner_1' }), runner({ id: 'runner_2' })],
      [{ runnerId: 'runner_1', currentRun: { id: 'run_7', state: 'claimed' } }],
    );

    expect(busy.currentRun).toEqual({ id: 'run_7', state: 'claimed' });
    expect(idle.currentRun).toBeNull();
  });
});
