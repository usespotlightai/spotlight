import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  HostResponseDto,
  IdleSandboxResponseDto,
  LiveRunnerResponseDto,
} from '@/lib/api';
import {
  type ActiveRunner,
  formatRun,
  type Host,
  heartbeatAt,
  hiddenFromViewer,
  hostInFilter,
  hostSlots,
  hostStatus,
  idleSandboxActivity,
  idleSandboxLabel,
  idleSandboxStatus,
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
  slotsTaken: 0,
  idleSandboxes: [],
  images: [],
  firstHeartbeatAt: '2026-08-30T09:00:00.000Z',
  onlineSince: '2026-08-30T11:00:00.000Z',
  lastHeartbeatAt: '2026-08-30T11:30:00.000Z',
  online: true,
  ...over,
});

const hosted = (
  over: Partial<Omit<Host, 'idleSandboxes'>> = {},
  idleSandboxes: Host['idleSandboxes'] = [],
): Host => ({
  ...host(),
  runners: [],
  ...over,
  idleSandboxes,
});

const idleSandbox = (
  over: Partial<IdleSandboxResponseDto> = {},
): IdleSandboxResponseDto => ({
  id: 'sandbox_1',
  key: 'work/task-task_1',
  warmLineId: null,
  status: 'ready',
  idleSince: '2026-08-30T11:53:00.000Z',
  startedAt: '2026-08-30T11:10:00.000Z',
  ...over,
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

const LEASED_RUN = {
  id: 'run_7',
  state: 'claimed',
  kind: 'task' as const,
  teamId: 'team_1',
  readable: true,
  title: 'Drain the stuck retry queues',
};

const busy = (id: string): ActiveRunner => ({
  ...runner({ id, hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' }),
  currentRun: LEASED_RUN,
});

describe('hostStatus', () => {
  it('counts the runs on a host', () => {
    expect(
      hostStatus(hosted({ runners: [busy('runner_1')], slotsTaken: 3 })),
    ).toBe('Running 1');
    expect(hostStatus(hosted({ slotsTaken: 2 }))).toBe('Idle');
    expect(
      hostStatus(
        hosted({ online: false, runners: [busy('runner_1')], slotsTaken: 1 }),
      ),
    ).toBe('Offline');
  });
});

describe('hostSlots', () => {
  it('counts the slots that runners and idle sandboxes take, while the host is online', () => {
    expect(hostSlots(hosted({ slotsTaken: 3 }))).toBe('3 of 4');
    expect(hostSlots(hosted())).toBe('0 of 4');
    expect(hostSlots(hosted({ online: false, slotsTaken: 1 }))).toBeNull();
  });
});

describe('hostInFilter', () => {
  it('calls a host with only idle sandboxes idle, not running', () => {
    const waiting = hosted({ slotsTaken: 1 }, [
      { ...idleSandbox(), lastRun: null },
    ]);

    expect(hostInFilter('running', waiting)).toBe(false);
    expect(hostInFilter('idle', waiting)).toBe(true);
    expect(
      hostInFilter('running', hosted({ runners: [busy('runner_1')] })),
    ).toBe(true);
  });
});

describe('idle sandboxes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('names a kept sandbox by its last run, and says how long it has waited', () => {
    const kept = { ...idleSandbox(), lastRun: LEASED_RUN };

    expect(idleSandboxLabel(kept)).toBe('Drain the stuck retry queues');
    expect(idleSandboxStatus(kept)).toBe('Waiting');
    expect(idleSandboxActivity(kept)).toBe('Idle since 7m ago');
    expect(idleSandboxLabel({ ...kept, lastRun: null })).toBe('Idle sandbox');
  });

  it('calls a ready warm sandbox ready, and says when it started', () => {
    const warm = {
      ...idleSandbox({ key: null, warmLineId: 'line_1' }),
      lastRun: null,
    };

    expect(idleSandboxStatus(warm)).toBe('Ready');
    expect(idleSandboxStatus({ ...warm, status: 'starting' })).toBe('Starting');
    expect(idleSandboxStatus({ ...warm, status: 'draining' })).toBe('Stopping');
    expect(idleSandboxActivity(warm)).toBe('Started 50m ago');
  });
});

describe('withActivity', () => {
  it('nests each runner under the host whose sandbox it runs in, with its run', () => {
    const { hosts, pools } = withActivity(
      {
        hosts: [host()],
        runners: [
          runner({ id: 'runner_1', hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' }),
        ],
      },
      {
        runners: [{ runnerId: 'runner_1', currentRun: LEASED_RUN }],
        workingCopies: [],
      },
    );

    expect(hosts[0]?.runners.map((each) => each.currentRun)).toEqual([
      LEASED_RUN,
    ]);
    expect(pools).toEqual([]);
  });

  it('gives each idle sandbox the last run of the working copy it keeps', () => {
    const { hosts } = withActivity(
      {
        hosts: [
          host({
            idleSandboxes: [
              idleSandbox(),
              idleSandbox({ id: 'sandbox_2', key: null, warmLineId: 'l_1' }),
            ],
          }),
        ],
        runners: [],
      },
      {
        runners: [],
        workingCopies: [{ key: 'work/task-task_1', lastRun: LEASED_RUN }],
      },
    );

    expect(hosts[0]?.idleSandboxes.map((each) => each.lastRun)).toEqual([
      LEASED_RUN,
      null,
    ]);
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
      { runners: [], workingCopies: [] },
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
