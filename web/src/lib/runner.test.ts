import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostResponseDto, LiveRunnerResponseDto } from '@/lib/api';
import {
  answeringCount,
  type Host,
  heldRunPath,
  hiddenFromViewer,
  runnerStanding,
  runShown,
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
  upSince: '2026-08-30T11:00:00.000Z',
  lastSeenAt: '2026-08-30T11:30:00.000Z',
  answering: true,
  ...over,
});

const hosted = (over: Partial<HostResponseDto> = {}): Host => ({
  ...host(over),
  runners: [],
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

  it('says how long an answering host has been up since it last came up', () => {
    expect(seenAt(hosted())).toBe('Up since 1h ago');
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

const HELD = {
  id: 'run_7',
  state: 'claimed',
  kind: 'task' as const,
  teamId: 'team_1',
  readable: true,
  title: 'Drain the stuck retry queues',
};

describe('withActivity', () => {
  it('nests each runner under the host whose sandbox it runs in, with its run', () => {
    const { hosts, pools } = withActivity(
      {
        hosts: [host()],
        runners: [
          runner({ id: 'runner_1', hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' }),
        ],
      },
      [{ runnerId: 'runner_1', currentRun: HELD }],
    );

    expect(hosts[0]?.runners.map((each) => each.currentRun)).toEqual([HELD]);
    expect(pools).toEqual([]);
  });

  it('gathers the runners no host started under the push pool that started them', () => {
    const { pools } = withActivity(
      {
        hosts: [],
        runners: [
          runner({ id: 'runner_1' }),
          runner({ id: 'runner_2', through: { kind: 'pool', key: 'burst' } }),
          runner({ id: 'runner_3' }),
        ],
      },
      [],
    );

    expect(
      pools.map((pool) => [
        pool.through.key,
        pool.runners.map((each) => each.id),
      ]),
    ).toEqual([
      ['ephemeral', ['runner_1', 'runner_3']],
      ['burst', ['runner_2']],
    ]);
  });
});

describe('runShown', () => {
  it('names the run, or says what kind it is where it cannot', () => {
    expect(runShown(HELD)).toBe('Drain the stuck retry queues');
    expect(runShown({ ...HELD, kind: 'search', title: null })).toBe(
      'A search run',
    );
    expect(runShown({ ...HELD, kind: 'spec', teamId: null, title: null })).toBe(
      'A run queued by hand',
    );
    expect(runShown(null)).toBe('No run yet');
  });
});

describe('runnerStanding', () => {
  it('says a runner is starting, running, or waiting on a person', () => {
    const active = runner();

    expect(runnerStanding({ ...active, currentRun: null })).toBe('Starting');
    expect(runnerStanding({ ...active, currentRun: HELD })).toBe('Running');
    expect(
      runnerStanding({ ...active, currentRun: { ...HELD, state: 'waiting' } }),
    ).toBe('Waiting on a person');
  });
});

describe('hiddenFromViewer', () => {
  it('hides a task run or chat of a team the viewer cannot read, never a replay, a search or a run for no team', () => {
    expect(hiddenFromViewer({ ...HELD, readable: false, title: null })).toBe(
      true,
    );
    expect(
      hiddenFromViewer({ ...HELD, kind: 'chat', readable: false, title: null }),
    ).toBe(true);
    expect(hiddenFromViewer(HELD)).toBe(false);
    expect(
      hiddenFromViewer({
        ...HELD,
        kind: 'search',
        readable: false,
        title: null,
      }),
    ).toBe(false);
    expect(
      hiddenFromViewer({ ...HELD, readable: false, teamId: null, title: null }),
    ).toBe(false);
    expect(hiddenFromViewer(null)).toBe(false);
  });
});

describe('heldRunPath', () => {
  it('links only a task run on a team the viewer reads', () => {
    expect(heldRunPath('acme', HELD)).toBe('/w/acme/team/team_1/runs/run_7');
    expect(
      heldRunPath('acme', { ...HELD, readable: false, title: null }),
    ).toBeNull();
    expect(heldRunPath('acme', { ...HELD, kind: 'chat' })).toBeNull();
  });
});

describe('answeringCount', () => {
  it('counts only the hosts still answering', () => {
    expect(
      answeringCount({
        hosts: [hosted(), hosted({ answering: false })],
        pools: [],
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
