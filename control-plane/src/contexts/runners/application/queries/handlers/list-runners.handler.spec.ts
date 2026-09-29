import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type {
  HostSummary,
  LiveRunnerSummary,
  RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-24T12:00:00.000Z');

const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const host = (overrides: Partial<HostSummary> = {}): HostSummary => ({
  id: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  name: 'build-box',
  through: { kind: 'pool', key: 'ephemeral' },
  release: '0.9.0',
  executor: 'docker',
  capacity: 4,
  running: ['runner_1'],
  images: [
    {
      image: 'ghcr.io/acme/runner:main',
      digest: null,
      usual: true,
      release: '0.9.0',
      harnesses: [{ id: 'claude-code', version: '2.1.0' }],
      refused: null,
    },
  ],
  firstSeenAt: ago(3_600_000),
  lastSeenAt: NOW,
  ...overrides,
});

const runner = (
  overrides: Partial<LiveRunnerSummary> = {},
): LiveRunnerSummary => ({
  id: 'runner_1',
  through: { kind: 'pool', key: 'ephemeral' },
  hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  image: 'ghcr.io/acme/runner:main',
  harnesses: ['claude-code'],
  startedAt: ago(60_000),
  lastSeenAt: null,
  ...overrides,
});

const clock = (): ClockPort => ({
  now: () => NOW,
  sleep: vi.fn().mockResolvedValue(undefined),
});

const MEMBER: WorkspaceMembership = {
  workspaceId: WorkspaceId.of('ws_1'),
  slug: 'acme',
  viewer: UserId.of('user_1'),
  administers: false,
};

const listing = (
  given: { hosts?: HostSummary[]; runners?: LiveRunnerSummary[] } = {},
  membership: WorkspaceMembership | null = MEMBER,
) => {
  const inWorkspace = vi.fn().mockResolvedValue(given.runners ?? []);
  const hostsIn = vi.fn().mockResolvedValue(given.hosts ?? []);

  const handler = new ListRunnersHandler(
    {
      inWorkspace: vi.fn().mockResolvedValue(membership),
    } as unknown as WorkspaceAccessPort,
    {
      inWorkspace,
      hostsIn,
      readyToRun: vi.fn(),
      advertisedModels: vi.fn(),
    } as RunnerReaderPort,
    clock(),
  );

  return { handler, inWorkspace, hostsIn };
};

const handle = async (
  given: { hosts?: HostSummary[]; runners?: LiveRunnerSummary[] } = {},
) => listing(given).handler.execute(new ListRunnersQuery('acme', 'user_1'));

describe('ListRunnersHandler', () => {
  it('reports a host heard from just now as answering', async () => {
    const fleet = await handle({ hosts: [host()] });

    expect(fleet?.hosts).toEqual([
      expect.objectContaining({
        id: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        through: { kind: 'pool', key: 'ephemeral' },
        running: ['runner_1'],
        images: [
          expect.objectContaining({
            image: 'ghcr.io/acme/runner:main',
            usual: true,
            harnesses: [{ id: 'claude-code', version: '2.1.0' }],
          }),
        ],
        lastSeenAt: NOW.toISOString(),
        answering: true,
      }),
    ]);
  });

  it('holds a host answering across a missed report', async () => {
    const fleet = await handle({ hosts: [host({ lastSeenAt: ago(60_000) })] });

    expect(fleet?.hosts[0]?.answering).toBe(true);
  });

  it('still lists a host that has gone quiet, marked not answering', async () => {
    const fleet = await handle({ hosts: [host({ lastSeenAt: ago(90_000) })] });

    expect(fleet?.hosts[0]?.answering).toBe(false);
  });

  it('remembers hosts for a day, and only those of the workspace asked about', async () => {
    const { handler, hostsIn, inWorkspace } = listing();

    await handler.execute(new ListRunnersQuery('acme', 'user_1'));

    expect(hostsIn).toHaveBeenCalledWith(
      MEMBER.workspaceId,
      ago(24 * 60 * 60_000),
    );
    expect(inWorkspace).toHaveBeenCalledWith(MEMBER.workspaceId);
  });

  it('lists the runners standing now, with the host each runs on', async () => {
    const fleet = await handle({
      runners: [
        runner(),
        runner({
          id: 'runner_2',
          through: { kind: 'trust', key: 'cluster' },
          hostId: null,
          image: null,
          lastSeenAt: NOW,
        }),
      ],
    });

    expect(fleet?.runners).toEqual([
      {
        id: 'runner_1',
        through: { kind: 'pool', key: 'ephemeral' },
        hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        image: 'ghcr.io/acme/runner:main',
        harnesses: ['claude-code'],
        startedAt: ago(60_000).toISOString(),
        lastSeenAt: null,
      },
      expect.objectContaining({
        id: 'runner_2',
        through: { kind: 'trust', key: 'cluster' },
        hostId: null,
        lastSeenAt: NOW.toISOString(),
      }),
    ]);
  });

  it('still lists a host and a runner whose pool is gone, with no key to name it by', async () => {
    const gone = { kind: 'pool' as const, key: null };
    const fleet = await handle({
      hosts: [host({ through: gone })],
      runners: [runner({ through: gone })],
    });

    expect(fleet?.hosts[0]?.through).toEqual(gone);
    expect(fleet?.runners[0]?.through).toEqual(gone);
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
