import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type {
  HostSummary,
  IdleSandboxSummary,
  LiveRunnerSummary,
} from '@runners/application/ports/runner-reader.port';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import { aRunner } from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-24T12:00:00.000Z');

const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const host = (overrides: Partial<HostSummary> = {}): HostSummary => ({
  id: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  name: 'build-box',
  source: { kind: 'pool', key: 'ephemeral', managed: false },
  release: '0.9.0',
  containerRuntime: 'docker',
  capacity: 4,
  reportedSandboxes: [],
  images: [
    {
      image: 'ghcr.io/acme/runner:main',
      digest: null,
      isDefault: true,
      release: '0.9.0',
      harnesses: [{ id: 'claude-code', version: '2.1.0' }],
      unavailableReason: null,
    },
  ],
  firstHeartbeatAt: ago(3_600_000),
  onlineSince: ago(1_800_000),
  lastHeartbeatAt: NOW,
  ...overrides,
});

const runner = (
  overrides: Partial<LiveRunnerSummary> = {},
): LiveRunnerSummary => ({
  id: 'runner_1',
  source: { kind: 'pool', key: 'ephemeral', managed: false },
  hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  image: 'ghcr.io/acme/runner:main',
  harnesses: ['claude-code'],
  startedAt: ago(60_000),
  lastHeartbeatAt: null,
  ...overrides,
});

const idleSandbox = (
  overrides: Partial<IdleSandboxSummary> = {},
): IdleSandboxSummary => ({
  id: 'sandbox_1',
  hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  key: 'work/task-task_1',
  warmLineId: null,
  warmImage: null,
  state: 'open',
  idleSince: ago(420_000),
  startedAt: ago(600_000),
  ...overrides,
});

type Fleet = {
  hosts?: HostSummary[];
  runners?: LiveRunnerSummary[];
  idleSandboxes?: IdleSandboxSummary[];
  alive?: Runner[];
  lastRanIn?: ReadonlyMap<string, string>;
};

const HOST = '01J8ZQ4Y7N3K5V2W9X6RTBHCDE';

const working = (id: string, host: string | null = HOST, enters?: string) =>
  aRunner({ id, host, enters }).claim(RunnerWork.run(`run_${id}`), NOW);

const clock = (): ClockPort => ({
  now: () => NOW,
  sleep: vi.fn().mockResolvedValue(undefined),
});

const MEMBER: WorkspaceMembership = {
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  viewer: UserId.of('user_1'),
  isAdmin: false,
};

const listing = (
  input: Fleet = {},
  membership: WorkspaceMembership | null = MEMBER,
) => {
  const inWorkspace = vi.fn().mockResolvedValue(input.runners ?? []);
  const hostsIn = vi.fn().mockResolvedValue(input.hosts ?? []);
  const idleSandboxesOn = vi.fn().mockResolvedValue(input.idleSandboxes ?? []);
  const aliveInWorkspace = vi
    .fn()
    .mockResolvedValue(
      input.alive ??
        (input.runners ?? []).map((each) => working(each.id, each.hostId)),
    );
  const lastRanIn = vi.fn().mockResolvedValue(input.lastRanIn ?? new Map());

  const handler = new ListRunnersHandler(
    {
      inWorkspace: vi.fn().mockResolvedValue(membership),
    } as unknown as WorkspaceAccessPort,
    {
      inWorkspace,
      hostsIn,
      idleSandboxesOn,
      readyToRun: vi.fn(),
      hasEgressCapableRunner: vi.fn(),
      supportedModels: vi.fn(),
    },
    { aliveInWorkspace } as unknown as RunnerRepository,
    { lastRanIn },
    clock(),
  );

  return {
    handler,
    inWorkspace,
    hostsIn,
    idleSandboxesOn,
    aliveInWorkspace,
    lastRanIn,
  };
};

const handle = async (input: Fleet = {}) =>
  listing(input).handler.execute(new ListRunnersQuery('acme', 'user_1'));

describe('ListRunnersHandler', () => {
  it('reports a host with a heartbeat just now as online', async () => {
    const fleet = await handle({ hosts: [host()] });

    expect(fleet?.hosts).toEqual([
      expect.objectContaining({
        id: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        source: { kind: 'pool', key: 'ephemeral', managed: false },
        slotsTaken: 0,
        slotsOffered: 4,
        idleSandboxes: [],
        images: [
          expect.objectContaining({
            image: 'ghcr.io/acme/runner:main',
            isDefault: true,
            harnesses: [{ id: 'claude-code', version: '2.1.0' }],
          }),
        ],
        lastHeartbeatAt: NOW.toISOString(),
        online: true,
      }),
    ]);
  });

  it('keeps a host online across a missed heartbeat', async () => {
    const fleet = await handle({
      hosts: [host({ lastHeartbeatAt: ago(60_000) })],
    });

    expect(fleet?.hosts[0]?.online).toBe(true);
  });

  it('still lists a host that is offline, and marks it offline', async () => {
    const fleet = await handle({
      hosts: [host({ lastHeartbeatAt: ago(90_000) })],
    });

    expect(fleet?.hosts[0]?.online).toBe(false);
  });

  it('lists hosts for a day after their last heartbeat, and only those of the workspace requested', async () => {
    const { handler, hostsIn, inWorkspace, idleSandboxesOn, aliveInWorkspace } =
      listing({ hosts: [host()] });

    await handler.execute(new ListRunnersQuery('acme', 'user_1'));

    expect(hostsIn).toHaveBeenCalledWith(
      MEMBER.workspaceId,
      ago(24 * 60 * 60_000),
    );
    expect(inWorkspace).toHaveBeenCalledWith(MEMBER.workspaceId);
    expect(idleSandboxesOn).toHaveBeenCalledWith([
      '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
    ]);
    expect(aliveInWorkspace).toHaveBeenCalledWith(MEMBER.workspaceId, NOW);
  });

  it('lists the runners that are alive now, with the host each runs on', async () => {
    const fleet = await handle({
      runners: [
        runner(),
        runner({
          id: 'runner_2',
          source: { kind: 'trust', key: 'cluster', managed: false },
          hostId: null,
          image: null,
          lastHeartbeatAt: NOW,
        }),
      ],
    });

    expect(fleet?.runners).toEqual([
      {
        id: 'runner_1',
        source: { kind: 'pool', key: 'ephemeral', managed: false },
        hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        image: 'ghcr.io/acme/runner:main',
        harnesses: ['claude-code'],
        startedAt: ago(60_000).toISOString(),
        lastHeartbeatAt: null,
      },
      expect.objectContaining({
        id: 'runner_2',
        source: { kind: 'trust', key: 'cluster', managed: false },
        hostId: null,
        lastHeartbeatAt: NOW.toISOString(),
      }),
    ]);
  });

  it('lists the idle sandboxes on each host, ready once the host reports them', async () => {
    const fleet = await handle({
      hosts: [host({ reportedSandboxes: ['sandbox_1'] })],
      idleSandboxes: [
        idleSandbox(),
        idleSandbox({
          id: 'sandbox_2',
          key: null,
          warmLineId: 'line_1',
          idleSince: ago(60_000),
          startedAt: ago(60_000),
        }),
        idleSandbox({ id: 'sandbox_3', state: 'draining' }),
        idleSandbox({ id: 'sandbox_4', hostId: 'other_host' }),
      ],
    });

    expect(fleet?.hosts[0]?.idleSandboxes).toEqual([
      {
        id: 'sandbox_1',
        workingCopyKey: 'work/task-task_1',
        warmLineId: null,
        image: null,
        status: 'ready',
        idleSince: ago(420_000).toISOString(),
        startedAt: ago(600_000).toISOString(),
      },
      expect.objectContaining({
        id: 'sandbox_2',
        warmLineId: 'line_1',
        status: 'starting',
      }),
      expect.objectContaining({ id: 'sandbox_3', status: 'draining' }),
    ]);
  });

  it('calls a reported sandbox starting while its host is offline', async () => {
    const fleet = await handle({
      hosts: [
        host({
          reportedSandboxes: ['sandbox_1'],
          lastHeartbeatAt: ago(90_000),
        }),
      ],
      idleSandboxes: [idleSandbox()],
    });

    expect(fleet?.hosts[0]?.idleSandboxes[0]?.status).toBe('starting');
  });

  it('counts a slot for each run and each idle sandbox, and none for a claim that waits for work', async () => {
    const fleet = await handle({
      hosts: [host()],
      runners: [
        runner({ id: 'runner_1' }),
        runner({ id: 'claim' }),
        runner({ id: 'waits' }),
      ],
      alive: [
        working('runner_1'),
        aRunner({ id: 'claim', host: HOST }),
        aRunner({ id: 'waits', host: HOST, enters: 'sandbox_2' }),
        working('runner_3', '01J8ZQ4Y7N3K5V2W9X6RTBHCD0'),
      ],
      idleSandboxes: [
        idleSandbox(),
        idleSandbox({ id: 'sandbox_2' }),
        idleSandbox({ id: 'sandbox_3', key: null, warmLineId: 'line_1' }),
      ],
    });

    expect(fleet?.hosts[0]).toEqual(
      expect.objectContaining({ slotsTaken: 4, slotsOffered: 0 }),
    );
    expect(fleet?.hosts[0]?.idleSandboxes.map((each) => each.id)).toEqual([
      'sandbox_1',
      'sandbox_2',
      'sandbox_3',
    ]);
    expect(fleet?.runners.map((each) => each.id)).toEqual(['runner_1']);
  });

  it('lists one row for each slot of a host with one run and five warm sandboxes', async () => {
    const warm = ['w1', 'w2', 'w3', 'w4', 'w5'];
    const fleet = await handle({
      hosts: [host({ capacity: 6 })],
      runners: [
        runner({ id: 'runner_1' }),
        ...warm.map((each) => runner({ id: `waits_${each}` })),
      ],
      alive: [
        working('runner_1'),
        ...warm.map((each) =>
          aRunner({ id: `waits_${each}`, host: HOST, enters: each }),
        ),
      ],
      idleSandboxes: warm.map((each) =>
        idleSandbox({ id: each, key: null, warmLineId: 'line_1' }),
      ),
    });
    const [onHost] = fleet?.hosts ?? [];

    expect(onHost).toEqual(
      expect.objectContaining({ slotsTaken: 6, slotsOffered: 0 }),
    );
    expect(
      (fleet?.runners.length ?? 0) + (onHost?.idleSandboxes.length ?? 0),
    ).toBe(6);
  });

  it('gives an idle sandbox one row and one slot however many runners wait in it', async () => {
    const fleet = await handle({
      hosts: [host()],
      runners: [runner({ id: 'old' }), runner({ id: 'new' })],
      alive: [
        aRunner({ id: 'old', host: HOST, enters: 'sandbox_1' }),
        aRunner({ id: 'new', host: HOST, enters: 'sandbox_1' }),
      ],
      idleSandboxes: [idleSandbox()],
    });

    expect(fleet?.runners).toEqual([]);
    expect(fleet?.hosts[0]?.idleSandboxes.map((each) => each.id)).toEqual([
      'sandbox_1',
    ]);
    expect(fleet?.hosts[0]).toEqual(
      expect.objectContaining({ slotsTaken: 1, slotsOffered: 3 }),
    );
  });

  it('lists a runner that works in an idle sandbox, not the sandbox', async () => {
    const fleet = await handle({
      hosts: [host()],
      runners: [runner()],
      alive: [working('runner_1', HOST, 'sandbox_1')],
      idleSandboxes: [idleSandbox()],
    });

    expect(fleet?.runners.map((each) => each.id)).toEqual(['runner_1']);
    expect(fleet?.hosts[0]?.idleSandboxes).toEqual([]);
    expect(fleet?.hosts[0]?.slotsTaken).toBe(1);
  });

  it('names the image of a warm sandbox from its line, or the host’s default one, and of a task’s sandbox from its last run', async () => {
    const digest = `ghcr.io/acme/widgets@sha256:${'a'.repeat(64)}`;
    const { handler, lastRanIn } = listing({
      hosts: [
        host({
          images: [
            ...host().images,
            {
              image: 'ghcr.io/acme/widgets:1',
              digest,
              isDefault: false,
              release: '0.9.0',
              harnesses: [],
              unavailableReason: null,
            },
          ],
        }),
      ],
      idleSandboxes: [
        idleSandbox({
          id: 'warm_default',
          key: null,
          warmLineId: 'line_1',
        }),
        idleSandbox({
          id: 'warm_widgets',
          key: null,
          warmLineId: 'line_2',
          warmImage: 'ghcr.io/acme/widgets:1',
        }),
        idleSandbox({
          id: 'warm_pinned',
          key: null,
          warmLineId: 'line_3',
          warmImage: digest,
        }),
        idleSandbox({ id: 'task_widgets', key: 'work/task-task_1' }),
        idleSandbox({ id: 'task_gone', key: 'work/task-task_2' }),
        idleSandbox({ id: 'task_never', key: 'work/task-task_3' }),
      ],
      lastRanIn: new Map([
        ['work/task-task_1', digest],
        ['work/task-task_2', `ghcr.io/acme/old@sha256:${'b'.repeat(64)}`],
      ]),
    });
    const fleet = await handler.execute(new ListRunnersQuery('acme', 'user_1'));

    expect(lastRanIn).toHaveBeenCalledWith(MEMBER.workspaceId, [
      'work/task-task_1',
      'work/task-task_2',
      'work/task-task_3',
    ]);
    expect(
      fleet?.hosts[0]?.idleSandboxes.map((each) => [each.id, each.image]),
    ).toEqual([
      ['warm_default', 'ghcr.io/acme/runner:main'],
      ['warm_widgets', 'ghcr.io/acme/widgets:1'],
      ['warm_pinned', 'ghcr.io/acme/widgets:1'],
      ['task_widgets', 'ghcr.io/acme/widgets:1'],
      ['task_gone', `ghcr.io/acme/old@sha256:${'b'.repeat(64)}`],
      ['task_never', null],
    ]);
  });

  it('lists the same alive runners that take the slots: a starting runner, and no runner whose heartbeat timed out', async () => {
    const fleet = await handle({
      hosts: [host()],
      runners: [
        runner(),
        runner({ id: 'runner_2' }),
        runner({ id: 'runner_3', hostId: null }),
      ],
      alive: [working('runner_1'), aRunner({ id: 'runner_3', host: null })],
    });

    expect(fleet?.runners.map((each) => each.id)).toEqual([
      'runner_1',
      'runner_3',
    ]);
    expect(fleet?.hosts[0]?.slotsTaken).toBe(1);
  });

  it('still lists a host and a runner whose pool is gone, with no key to name it by', async () => {
    const gone = { kind: 'pool' as const, key: null, managed: false };
    const fleet = await handle({
      hosts: [host({ source: gone })],
      runners: [runner({ source: gone })],
    });

    expect(fleet?.hosts[0]?.source).toEqual(gone);
    expect(fleet?.runners[0]?.source).toEqual(gone);
  });

  it('lists nothing for someone outside the workspace', async () => {
    const { handler, inWorkspace, hostsIn } = listing(
      { hosts: [host()], runners: [runner()] },
      null,
    );

    await expect(
      handler.execute(new ListRunnersQuery('acme', 'user_1')),
    ).resolves.toBeNull();
    expect(inWorkspace).not.toHaveBeenCalled();
    expect(hostsIn).not.toHaveBeenCalled();
  });

  it('answers an empty fleet with empty lists rather than absence', async () => {
    await expect(handle()).resolves.toEqual({ hosts: [], runners: [] });
  });
});
