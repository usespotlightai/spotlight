import type {
  AdmittedHost,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aPullPool,
  aRunner,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const NOW = new Date('2026-09-24T10:00:00.000Z');

const pooling = (
  admitted: AdmittedHost | null,
  held: { pool?: RunnerPool | null; standing?: readonly Runner[] } = {},
) => {
  const admit = vi.fn(async () => admitted);
  const find = vi.fn(async () =>
    held.pool === undefined ? aPullPool({ maxRuns: 2 }) : held.pool,
  );

  const pools = new RunnerPools(
    { find } as unknown as RunnerPoolRepository,
    {
      standingIn: vi.fn(async () => held.standing ?? []),
    } as unknown as RunnerRepository,
    {} as RunnerResourcesPort,
    { admit } satisfies RunnerAdmissionsPort,
  );

  return { pools, admit, find };
};

const THROUGH_POOL: AdmittedHost = {
  way: { kind: 'pool', id: POOL_ID.value },
  workspaceId: WORKSPACE,
};

describe('RunnerPools', () => {
  describe('the pool a token pulls with', () => {
    it('answers the pool the admissions let the token in through, at work', async () => {
      const { pools, admit } = pooling(THROUGH_POOL);

      await expect(
        pools.pulledWith('pool-token', POOL_ID.value),
      ).resolves.toEqual({
        poolId: POOL_ID.value,
        workspaceId: WORKSPACE,
        key: 'ephemeral',
        labels: expect.objectContaining({ values: ['linux'] }),
      });
      expect(admit).toHaveBeenCalledWith({
        bearer: 'pool-token',
        trust: undefined,
      });
    });

    it('answers no pool for another pool than the token’s own', async () => {
      const { pools, find } = pooling(THROUGH_POOL);

      await expect(
        pools.pulledWith('pool-token', 'pool_2'),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });

    it('answers no pool where the admissions let nothing in', async () => {
      const { pools, find } = pooling(null);

      await expect(
        pools.pulledWith('stolen', POOL_ID.value),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });

    it('answers no pool for a way in that is a trust', async () => {
      const { pools, find } = pooling({
        way: { kind: 'trust', id: 'trust_1' },
        workspaceId: WORKSPACE,
      });

      await expect(
        pools.pulledWith('workload-token', 'trust_1'),
      ).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });

  describe('the room a pool has left', () => {
    it('is what maxRuns leaves beside the runners standing in it', async () => {
      const { pools } = pooling(null, { standing: [aRunner()] });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBe(1);
    });

    it('is unbounded for a pool without maxRuns', async () => {
      const { pools } = pooling(null, {
        pool: aPullPool(),
        standing: [aRunner(), aRunner({ id: 'pooled_2' })],
      });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBeNull();
    });

    it('is none for a pool that is gone or retired', async () => {
      await expect(
        pooling(null, { pool: null }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
      await expect(
        pooling(null, {
          pool: aPullPool().retired(attributedIn()),
        }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
    });
  });
});
