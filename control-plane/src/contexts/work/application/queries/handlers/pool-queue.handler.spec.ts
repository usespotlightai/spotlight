import type {
  PoolAtWork,
  RunnerPoolsPort,
} from '@runners/application/ports/runner-pools.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { PoolQueueHandler } from '@work/application/queries/handlers/pool-queue.handler';
import { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T09:00:00.000Z');

const POOL: PoolAtWork = {
  poolId: 'pool_1',
  workspaceId: WorkspaceId.of('ws_1'),
  key: 'burst',
  labels: RunnerTerms.of(['linux', 'gpu']),
};

const queueOf = (
  room: number | null,
  placements: readonly RunnerPlacement[],
  running = 2,
  checks: readonly RunnerPlacement[] = [],
) => {
  const unclaimedIn = vi.fn(async () => placements);

  return {
    unclaimedIn,
    handler: new PoolQueueHandler(
      {
        pulledWith: async (token: string | undefined, poolId: string) =>
          token === 'pool-token' && poolId === POOL.poolId ? POOL : null,
        provisioning: async () => [],
        running: async () => running,
        roomIn: async () => room,
      } satisfies RunnerPoolsPort,
      { unclaimedIn },
      {
        claimNext: vi.fn(async () => null),
        claimReserved: vi.fn(async () => null),
        unclaim: vi.fn(async () => {}),
        renewLease: vi.fn(async () => 'renewed' as const),
        waitingPlacements: vi.fn(async () => checks),
      },
      { now: () => NOW } as ClockPort,
    ),
  };
};

const WAITING = [
  RunnerPlacement.anywhere(),
  RunnerPlacement.of(['gpu']),
  RunnerPlacement.of(['gpu', 'linux']),
  RunnerPlacement.of(['vpc-internal']),
  RunnerPlacement.anywhere().in(RunnerImage.of('ghcr.io/acme/widgets:1')),
];

describe('PoolQueueHandler', () => {
  it('counts the checks waiting that the pool could run beside its runs', async () => {
    const { handler } = queueOf(null, [], 0, [
      RunnerPlacement.of(['gpu']),
      RunnerPlacement.of(['arm']),
    ]);

    expect(
      await handler.execute(new PoolQueueQuery('pool-token', 'pool_1')),
    ).toMatchObject({ pending: 1, labels: { gpu: 1, linux: 0 } });
  });

  it('answers nothing to a token no pool pulls with', async () => {
    const { handler, unclaimedIn } = queueOf(3, WAITING);

    expect(
      await handler.execute(new PoolQueueQuery('stolen', 'pool_1')),
    ).toBeNull();
    expect(unclaimedIn).not.toHaveBeenCalled();
  });

  it('answers nothing about another pool than the token’s own', async () => {
    const { handler } = queueOf(3, WAITING);

    expect(
      await handler.execute(new PoolQueueQuery('pool-token', 'pool_2')),
    ).toBeNull();
  });

  it('counts the waiting runs the pool could take, and what it is running', async () => {
    const { handler, unclaimedIn } = queueOf(3, WAITING);

    expect(
      await handler.execute(new PoolQueueQuery('pool-token', 'pool_1')),
    ).toEqual({
      pending: 4,
      running: 2,
      capacity: 3,
      labels: { linux: 1, gpu: 2 },
    });
    expect(unclaimedIn).toHaveBeenCalledWith(WorkspaceId.of('ws_1'), NOW);
  });

  it('has no capacity to speak of when the pool sets no limit', async () => {
    const { handler } = queueOf(null, []);

    expect(
      (await handler.execute(new PoolQueueQuery('pool-token', 'pool_1')))
        ?.capacity,
    ).toBeNull();
  });

  it('answers the room the runners context leaves the pool as its capacity', async () => {
    const { handler } = queueOf(0, [], 3);

    expect(
      (await handler.execute(new PoolQueueQuery('pool-token', 'pool_1')))
        ?.capacity,
    ).toBe(0);
  });
});
