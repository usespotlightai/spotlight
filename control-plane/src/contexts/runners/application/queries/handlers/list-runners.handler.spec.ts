import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import type {
  RunnerReaderPort,
  RunnerSummary,
} from '@runners/application/ports/runner-reader.port';
import { ListRunnersHandler } from '@runners/application/queries/handlers/list-runners.handler';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-24T12:00:00.000Z');

const summary = (overrides: Partial<RunnerSummary> = {}): RunnerSummary => ({
  id: 'runner_1',
  name: 'Build server',
  harnesses: ['claude-code'],
  registeredAt: new Date('2026-08-24T11:00:00.000Z'),
  lastSeenAt: NOW,
  revokedAt: null,
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
  runners: RunnerSummary[],
  membership: WorkspaceMembership | null = MEMBER,
) => {
  const inWorkspace = vi.fn().mockResolvedValue(runners);

  const handler = new ListRunnersHandler(
    {
      inWorkspace: vi.fn().mockResolvedValue(membership),
    } as unknown as WorkspaceAccessPort,
    {
      inWorkspace,
      anyConnected: vi.fn(),
      advertisedModels: vi.fn(),
    } as RunnerReaderPort,
    clock(),
  );

  return { handler, inWorkspace };
};

const handle = async (runners: RunnerSummary[]) =>
  (await listing(runners).handler.execute(
    new ListRunnersQuery('acme', 'user_1'),
  )) ?? [];

describe('ListRunnersHandler', () => {
  it('reports a runner heard from just now as connected', async () => {
    const [only] = await handle([summary()]);

    expect(only).toMatchObject({
      id: 'runner_1',
      harnesses: ['claude-code'],
      connected: true,
    });
  });

  it('lists only the runners of the workspace asked about', async () => {
    const { handler, inWorkspace } = listing([summary()]);

    await handler.execute(new ListRunnersQuery('acme', 'user_1'));

    expect(inWorkspace).toHaveBeenCalledWith(MEMBER.workspaceId);
  });

  it('lists nothing for someone outside the workspace', async () => {
    const { handler, inWorkspace } = listing([summary()], null);

    await expect(
      handler.execute(new ListRunnersQuery('acme', 'user_1')),
    ).resolves.toBeNull();
    expect(inWorkspace).not.toHaveBeenCalled();
  });

  it('still lists a runner that has gone quiet, marked disconnected', async () => {
    const quiet = new Date(NOW.getTime() - 60_000);

    await expect(handle([summary({ lastSeenAt: quiet })])).resolves.toEqual([
      expect.objectContaining({ connected: false }),
    ]);
  });

  it('holds a runner connected across a missed heartbeat', async () => {
    const recent = new Date(NOW.getTime() - 20_000);

    await expect(handle([summary({ lastSeenAt: recent })])).resolves.toEqual([
      expect.objectContaining({ connected: true }),
    ]);
  });

  it('answers an empty fleet with an empty list rather than absence', async () => {
    await expect(handle([])).resolves.toEqual([]);
  });

  it('does not call a runner that has never checked in connected', async () => {
    const [never] = await handle([summary({ lastSeenAt: null })]);

    expect(never.connected).toBe(false);
  });

  it('does not call a revoked runner connected', async () => {
    const [revoked] = await handle([summary({ revokedAt: NOW })]);

    expect(revoked.connected).toBe(false);
  });
});
