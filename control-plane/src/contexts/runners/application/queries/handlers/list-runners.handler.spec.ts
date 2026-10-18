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
  source: { kind: 'pool', key: 'ephemeral' },
  release: '0.9.0',
  containerRuntime: 'docker',
  capacity: 4,
  running: ['runner_1'],
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
  source: { kind: 'pool', key: 'ephemeral' },
  hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
  image: 'ghcr.io/acme/runner:main',
  harnesses: ['claude-code'],
  startedAt: ago(60_000),
  lastHeartbeatAt: null,
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
  isAdmin: false,
};

const listing = (
  input: { hosts?: HostSummary[]; runners?: LiveRunnerSummary[] } = {},
  membership: WorkspaceMembership | null = MEMBER,
) => {
  const inWorkspace = vi.fn().mockResolvedValue(input.runners ?? []);
  const hostsIn = vi.fn().mockResolvedValue(input.hosts ?? []);

  const handler = new ListRunnersHandler(
    {
      inWorkspace: vi.fn().mockResolvedValue(membership),
    } as unknown as WorkspaceAccessPort,
    {
      inWorkspace,
      hostsIn,
      readyToRun: vi.fn(),
      hasEgressCapableRunner: vi.fn(),
      supportedModels: vi.fn(),
    } as RunnerReaderPort,
    clock(),
  );

  return { handler, inWorkspace, hostsIn };
};

const handle = async (
  input: { hosts?: HostSummary[]; runners?: LiveRunnerSummary[] } = {},
) => listing(input).handler.execute(new ListRunnersQuery('acme', 'user_1'));

describe('ListRunnersHandler', () => {
  it('reports a host with a heartbeat just now as online', async () => {
    const fleet = await handle({ hosts: [host()] });

    expect(fleet?.hosts).toEqual([
      expect.objectContaining({
        id: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        source: { kind: 'pool', key: 'ephemeral' },
        running: ['runner_1'],
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
    const { handler, hostsIn, inWorkspace } = listing();

    await handler.execute(new ListRunnersQuery('acme', 'user_1'));

    expect(hostsIn).toHaveBeenCalledWith(
      MEMBER.workspaceId,
      ago(24 * 60 * 60_000),
    );
    expect(inWorkspace).toHaveBeenCalledWith(MEMBER.workspaceId);
  });

  it('lists the runners that are alive now, with the host each runs on', async () => {
    const fleet = await handle({
      runners: [
        runner(),
        runner({
          id: 'runner_2',
          source: { kind: 'trust', key: 'cluster' },
          hostId: null,
          image: null,
          lastHeartbeatAt: NOW,
        }),
      ],
    });

    expect(fleet?.runners).toEqual([
      {
        id: 'runner_1',
        source: { kind: 'pool', key: 'ephemeral' },
        hostId: '01J8ZQ4Y7N3K5V2W9X6RTBHCDE',
        image: 'ghcr.io/acme/runner:main',
        harnesses: ['claude-code'],
        startedAt: ago(60_000).toISOString(),
        lastHeartbeatAt: null,
      },
      expect.objectContaining({
        id: 'runner_2',
        source: { kind: 'trust', key: 'cluster' },
        hostId: null,
        lastHeartbeatAt: NOW.toISOString(),
      }),
    ]);
  });

  it('still lists a host and a runner whose pool is gone, with no key to name it by', async () => {
    const gone = { kind: 'pool' as const, key: null };
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
