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
  type HostChild,
  hostChildren,
  hostInFilter,
  hostSlots,
  hostSlotsTip,
  hostStatus,
  type IdleSandbox,
  idleSandboxLabel,
  imageHarnesses,
  leasedRunPath,
  onlineCount,
  runnerStatus,
  sandboxActivity,
  sandboxStatus,
  sandboxStatusTip,
  sourceLabel,
  warmSandboxLabel,
  withActivity,
} from '@/lib/runner';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const host = (over: Partial<HostResponseDto> = {}): HostResponseDto => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  source: { kind: 'pool', key: 'build-farm', platform: null },
  release: 'v1.4.0',
  unavailableReason: null,
  containerRuntime: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  slotsTaken: 0,
  slotsOffered: 4,
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
  workingCopyKey: 'work/task-task_1',
  warmLineId: null,
  image: 'ghcr.io/acme/runner:main',
  status: 'ready',
  idleSince: '2026-08-30T11:53:00.000Z',
  startedAt: '2026-08-30T11:10:00.000Z',
  ...over,
});

const runner = (
  over: Partial<LiveRunnerResponseDto> = {},
): LiveRunnerResponseDto => ({
  id: 'runner_1',
  source: { kind: 'pool', key: 'ephemeral', platform: null },
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

describe('hostSlotsTip', () => {
  it('counts what takes the slots of a host, and the slots still free', () => {
    const warm = (id: string) => ({
      ...idleSandbox({ id, workingCopyKey: null, warmLineId: 'line_1' }),
      lastRun: null,
    });

    expect(
      hostSlotsTip(
        hosted({ runners: [busy('runner_1')], slotsOffered: 1 }, [
          { ...idleSandbox(), lastRun: null },
          warm('sandbox_2'),
          warm('sandbox_3'),
        ]),
      ),
    ).toEqual({
      rows: [
        ['Runs', '1'],
        ['Warm sandboxes', '2'],
        ['Idle sandboxes', '1'],
        ['Free', '1'],
      ],
    });
  });
});

const idle = (over: Partial<IdleSandboxResponseDto> = {}): IdleSandbox => ({
  ...idleSandbox(over),
  lastRun: null,
});

const warmFor = (
  id: string,
  line: string,
  over: Partial<IdleSandboxResponseDto> = {},
): IdleSandbox => idle({ id, workingCopyKey: null, warmLineId: line, ...over });

const shape = (child: HostChild): string =>
  child.kind === 'run'
    ? `run ${child.runner.id}`
    : child.row.sandboxes.map((each) => each.id).join('+');

describe('hostChildren', () => {
  it('lists runs, starting runs, idle sandboxes, warm sandboxes by line, then the ones that stop', () => {
    const starting = { ...busy('runner_2'), currentRun: null };
    const children = hostChildren(
      hosted({ runners: [starting, busy('runner_1')] }, [
        warmFor('warm_b1', 'line_b'),
        idle({ id: 'stopping', status: 'draining' }),
        warmFor('warm_a1', 'line_a'),
        idle({ id: 'task_1' }),
        warmFor('warm_b2', 'line_b', { status: 'starting' }),
        warmFor('warm_b3', 'line_b'),
      ]),
    );

    expect(children.map(shape)).toEqual([
      'run runner_1',
      'run runner_2',
      'task_1',
      'warm_b2',
      'warm_b1+warm_b3',
      'warm_a1',
      'stopping',
    ]);
  });

  it('keeps warm sandboxes apart that run different images', () => {
    const children = hostChildren(
      hosted({}, [
        warmFor('warm_1', 'line_a'),
        warmFor('warm_2', 'line_a', { image: 'ghcr.io/acme/widgets:1' }),
        warmFor('warm_3', 'line_a'),
      ]),
    );

    expect(children.map(shape)).toEqual(['warm_1+warm_3', 'warm_2']);
  });
});

describe('sandbox rows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('names a task’s sandbox by its last run, calls it idle, and says how long it has waited', () => {
    const sandbox = { ...idle(), lastRun: LEASED_RUN };

    expect(idleSandboxLabel(sandbox)).toBe('Drain the stuck retry queues');
    expect(sandboxStatus(sandbox)).toBe('Idle');
    expect(sandboxActivity({ id: sandbox.id, sandboxes: [sandbox] })).toBe(
      'Idle since 7m ago',
    );
    expect(sandboxStatusTip(sandbox, undefined)).toBe(
      'Sandbox holds this task’s workspace for its next run.',
    );
    expect(idleSandboxLabel({ ...sandbox, lastRun: null })).toBe(
      'Idle sandbox',
    );
  });

  it('calls a warm sandbox starting, then ready, and stopping while it drains', () => {
    const warm = warmFor('sandbox_1', 'line_1');

    expect(sandboxStatus({ ...warm, status: 'starting' })).toBe('Starting');
    expect(sandboxStatus(warm)).toBe('Ready');
    expect(sandboxStatus({ ...warm, status: 'draining' })).toBe('Stopping');
    expect(sandboxStatusTip({ ...warm, status: 'starting' }, 'Delivery')).toBe(
      null,
    );
    expect(sandboxStatusTip(warm, 'Delivery')).toBe(
      'Sandbox has Delivery’s repositories set up. It takes the first run of a task on this line.',
    );
    expect(sandboxStatusTip({ ...warm, status: 'draining' }, 'Delivery')).toBe(
      'Spotlight stops this sandbox. Its slot is free when it stops.',
    );
  });

  it('counts merged warm sandboxes in the name, and says when the oldest started', () => {
    const row = {
      id: 'sandbox_1',
      sandboxes: [
        warmFor('sandbox_1', 'line_1', {
          startedAt: '2026-08-30T11:40:00.000Z',
        }),
        warmFor('sandbox_2', 'line_1', {
          startedAt: '2026-08-30T11:10:00.000Z',
        }),
      ],
    } as const;

    expect(warmSandboxLabel(5, 'Delivery')).toBe(
      '5 warm sandboxes for Delivery',
    );
    expect(warmSandboxLabel(1, 'Delivery')).toBe('Warm sandbox for Delivery');
    expect(warmSandboxLabel(2, undefined)).toBe('2 warm sandboxes');
    expect(sandboxActivity(row)).toBe('Started 50m ago');
  });

  it('names the harnesses of the host image a sandbox runs', () => {
    const onHost = hosted({
      images: [
        {
          image: 'ghcr.io/acme/runner:main',
          digest: null,
          isDefault: true,
          release: null,
          harnesses: [{ id: 'claude-code', version: '2.1.0' }],
          unavailableReason: null,
        },
      ],
    });

    expect(
      imageHarnesses(onHost, 'ghcr.io/acme/runner:main', [
        { id: 'claude-code', name: 'Claude Code' },
      ]),
    ).toEqual([{ id: 'claude-code', name: 'Claude Code', version: '2.1.0' }]);
    expect(imageHarnesses(onHost, null, undefined)).toEqual([]);
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
        readyToRun: true,
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
              idleSandbox({
                id: 'sandbox_2',
                workingCopyKey: null,
                warmLineId: 'l_1',
              }),
            ],
          }),
        ],
        runners: [],
        readyToRun: true,
      },
      {
        runners: [],
        workingCopies: [
          { workingCopyKey: 'work/task-task_1', lastRun: LEASED_RUN },
        ],
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
          runner({
            id: 'runner_2',
            source: { kind: 'pool', key: 'burst', platform: null },
          }),
          runner({ id: 'runner_3' }),
        ],
        readyToRun: true,
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

  it('says the task or agent chat is deleted where the viewer reads its team but it has no title', () => {
    expect(formatRun({ ...LEASED_RUN, title: null })).toBe('Deleted task');
    expect(formatRun({ ...LEASED_RUN, kind: 'chat', title: null })).toBe(
      'Deleted agent chat',
    );
    expect(formatRun({ ...LEASED_RUN, readable: false, title: null })).toBe(
      'Title hidden. This run belongs to a team you’re not on.',
    );
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
        readyToRun: true,
      }),
    ).toBe(1);
  });
});

describe('sourceLabel', () => {
  it('names the pool or trust, or says it is gone', () => {
    expect(
      sourceLabel({ kind: 'pool', key: 'build-farm', platform: null }),
    ).toBe('Pool build-farm');
    expect(sourceLabel({ kind: 'trust', key: null, platform: null })).toBe(
      'Trust deleted',
    );
  });
});
