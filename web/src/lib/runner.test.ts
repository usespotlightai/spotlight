import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostResponseDto, LiveRunnerResponseDto } from '@/lib/api';
import {
  formatRun,
  type Host,
  heartbeatAt,
  hiddenFromViewer,
  hostStatus,
  leasedRunPath,
  onlineCount,
  runnerStatus,
  sourceLabel,
  withActivity,
} from '@/lib/runner';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const host = (over: Partial<HostResponseDto> = {}): HostResponseDto => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  source: { kind: 'pool', key: 'build-farm' },
  release: 'v1.4.0',
  unavailableReason: null,
  containerRuntime: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  running: [],
  images: [],
  firstHeartbeatAt: '2026-08-30T09:00:00.000Z',
  onlineSince: '2026-08-30T11:00:00.000Z',
  lastHeartbeatAt: '2026-08-30T11:30:00.000Z',
  online: true,
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
  source: { kind: 'pool', key: 'ephemeral' },
  hostId: null,
  image: null,
  harnesses: [],
  startedAt: '2026-08-30T11:00:00.000Z',
  lastHeartbeatAt: null,
  ...over,
});

describe('heartbeatAt', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('says when an online host came online', () => {
    expect(heartbeatAt(hosted())).toBe('Online since 1h ago');
  });

  it('says when an offline host sent its last heartbeat', () => {
    expect(heartbeatAt(hosted({ online: false }))).toBe(
      'Last heartbeat 30m ago',
    );
  });
});

describe('hostStatus', () => {
  it('counts what a host runs against what it can', () => {
    expect(hostStatus(hosted({ running: ['runner_1'] }))).toBe(
      'Running 1 of 4',
    );
    expect(hostStatus(hosted())).toBe('Idle');
    expect(hostStatus(hosted({ online: false, running: ['runner_1'] }))).toBe(
      'Offline',
    );
  });
});

const LEASED_RUN = {
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
      [{ runnerId: 'runner_1', currentRun: LEASED_RUN }],
    );

    expect(hosts[0]?.runners.map((each) => each.currentRun)).toEqual([
      LEASED_RUN,
    ]);
    expect(pools).toEqual([]);
  });

  it('gathers the runners no host started under the push pool that started them', () => {
    const { pools } = withActivity(
      {
        hosts: [],
        runners: [
          runner({ id: 'runner_1' }),
          runner({ id: 'runner_2', source: { kind: 'pool', key: 'burst' } }),
          runner({ id: 'runner_3' }),
        ],
      },
      [],
    );

    expect(
      pools.map((pool) => [
        pool.source.key,
        pool.runners.map((each) => each.id),
      ]),
    ).toEqual([
      ['ephemeral', ['runner_1', 'runner_3']],
      ['burst', ['runner_2']],
    ]);
  });
});

describe('formatRun', () => {
  it('names the run, or says what kind it is where it cannot', () => {
    expect(formatRun(LEASED_RUN)).toBe('Drain the stuck retry queues');
    expect(formatRun({ ...LEASED_RUN, kind: 'search', title: null })).toBe(
      'A search run',
    );
    expect(
      formatRun({ ...LEASED_RUN, kind: 'spec', teamId: null, title: null }),
    ).toBe('A run queued by hand');
    expect(formatRun(null)).toBe('No run yet');
  });
});

describe('runnerStatus', () => {
  it('says a runner is starting or running', () => {
    const active = runner();

    expect(runnerStatus({ ...active, currentRun: null })).toBe('Starting');
    expect(runnerStatus({ ...active, currentRun: LEASED_RUN })).toBe('Running');
  });
});

describe('hiddenFromViewer', () => {
  it('hides a task run or chat of a team the viewer cannot read, never a replay, a search or a run for no team', () => {
    expect(
      hiddenFromViewer({ ...LEASED_RUN, readable: false, title: null }),
    ).toBe(true);
    expect(
      hiddenFromViewer({
        ...LEASED_RUN,
        kind: 'chat',
        readable: false,
        title: null,
      }),
    ).toBe(true);
    expect(hiddenFromViewer(LEASED_RUN)).toBe(false);
    expect(
      hiddenFromViewer({
        ...LEASED_RUN,
        kind: 'search',
        readable: false,
        title: null,
      }),
    ).toBe(false);
    expect(
      hiddenFromViewer({
        ...LEASED_RUN,
        readable: false,
        teamId: null,
        title: null,
      }),
    ).toBe(false);
    expect(hiddenFromViewer(null)).toBe(false);
  });
});

describe('leasedRunPath', () => {
  it('links only a task run on a team the viewer reads', () => {
    expect(leasedRunPath('acme', LEASED_RUN)).toBe(
      '/w/acme/team/team_1/runs/run_7',
    );
    expect(
      leasedRunPath('acme', { ...LEASED_RUN, readable: false, title: null }),
    ).toBeNull();
    expect(leasedRunPath('acme', { ...LEASED_RUN, kind: 'chat' })).toBeNull();
  });
});

describe('onlineCount', () => {
  it('counts only the hosts still online', () => {
    expect(
      onlineCount({
        hosts: [hosted(), hosted({ online: false })],
        pools: [],
      }),
    ).toBe(1);
  });
});

describe('sourceLabel', () => {
  it('names the pool or trust, or says it is gone', () => {
    expect(sourceLabel({ kind: 'pool', key: 'build-farm' })).toBe(
      'Pool build-farm',
    );
    expect(sourceLabel({ kind: 'trust', key: null })).toBe('Trust deleted');
  });
});
