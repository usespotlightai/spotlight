import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostResponseDto, LiveRunnerResponseDto } from '@/lib/api';
import {
  answeringCount,
  type Host,
  seenAt,
  since,
  standing,
  through,
  withActivity,
} from '@/lib/runner';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const host = (over: Partial<HostResponseDto> = {}): HostResponseDto => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  through: { kind: 'pool', key: 'build-farm' },
  release: 'v1.4.0',
  executor: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  running: [],
  images: [],
  firstSeenAt: '2026-08-30T09:00:00.000Z',
  lastSeenAt: '2026-08-30T11:30:00.000Z',
  answering: true,
  ...over,
});

const hosted = (over: Partial<HostResponseDto> = {}): Host => ({
  ...host(over),
  runs: [],
});

const runner = (
  over: Partial<LiveRunnerResponseDto> = {},
): LiveRunnerResponseDto => ({
  id: 'runner_1',
  through: { kind: 'pool', key: 'ephemeral' },
  hostId: null,
  image: null,
  harnesses: [],
  startedAt: '2026-08-30T11:00:00.000Z',
  lastSeenAt: null,
  ...over,
});

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

  it('says how long an answering host has been up', () => {
    expect(seenAt(hosted())).toBe('Up since 3h ago');
  });

  it('says when a silent host was last heard from', () => {
    expect(seenAt(hosted({ answering: false }))).toBe('Last seen 30m ago');
  });
});

describe('standing', () => {
  it('counts what a host runs against what it can', () => {
    expect(standing(hosted({ running: ['runner_1'] }))).toBe('Running 1 of 4');
    expect(standing(hosted())).toBe('Idle');
    expect(standing(hosted({ answering: false, running: ['runner_1'] }))).toBe(
      'Not answering',
    );
  });
});

describe('withActivity', () => {
  it('gives each host the runs its runners hold', () => {
    const { hosts } = withActivity(
      { hosts: [host({ running: ['runner_1', 'runner_2'] })], runners: [] },
      [{ runnerId: 'runner_1', currentRun: { id: 'run_7', state: 'claimed' } }],
    );

    expect(hosts[0].runs).toEqual([{ id: 'run_7', state: 'claimed' }]);
  });

  it('keeps apart only the runners no host started', () => {
    const { provisioned } = withActivity(
      {
        hosts: [],
        runners: [
          runner({ id: 'runner_1' }),
          runner({ id: 'runner_2', hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' }),
        ],
      },
      [{ runnerId: 'runner_1', currentRun: { id: 'run_7', state: 'running' } }],
    );

    expect(provisioned.map((each) => each.id)).toEqual(['runner_1']);
    expect(provisioned[0].currentRun).toEqual({
      id: 'run_7',
      state: 'running',
    });
  });
});

describe('answeringCount', () => {
  it('counts only the hosts still answering', () => {
    expect(
      answeringCount({
        hosts: [hosted(), hosted({ answering: false })],
        provisioned: [],
      }),
    ).toBe(1);
  });
});

describe('through', () => {
  it('names the pool or trust, or says it is gone', () => {
    expect(through({ kind: 'pool', key: 'build-farm' })).toBe(
      'Pool build-farm',
    );
    expect(through({ kind: 'trust', key: null })).toBe(
      'Trust no longer defined',
    );
  });
});
