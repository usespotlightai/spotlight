import type {
  AdmittedHost,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type {
  RunnerPoolRecord,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
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
  stored: {
    pool?: RunnerPool | null;
    alive?: readonly Runner[];
    provisioning?: readonly RunnerPoolRecord[];
    platform?: boolean;
  } = {},
) => {
  const admit = vi.fn(async () => admitted);
  const find = vi.fn(async () =>
    stored.pool === undefined ? aPullPool({ maxRuns: 2 }) : stored.pool,
  );

  const pools = new RunnerPools(
    { find } as unknown as RunnerPoolRepository,
    {
      aliveIn: vi.fn(async () => stored.alive ?? []),
    } as unknown as RunnerRepository,
    {
      provisioningPools: vi.fn(async () => stored.provisioning ?? []),
    } as unknown as RunnerResourcesPort,
    { admit } satisfies RunnerAdmissionsPort,
    stored.platform ?? true,
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
        egress: false,
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

  describe('the pools that provision', () => {
    const kept = (egress: string | null): RunnerPoolRecord => ({
      id: `pool_${egress ?? 'none'}`,
      version: 0,
      workspaceId: WORKSPACE,
      key: 'sandboxes',
      labels: ['sandbox'],
      maxRuns: null,
      tokenVersion: null,
      provision: {
        url: 'https://provision.example.com/runs',
        secretVersion: 1,
        egress,
        egressTraffic: 'all',
      },
    });

    it('says of each whether it names an egress', async () => {
      const { pools } = pooling(null, {
        provisioning: [kept('spotlight'), kept('egress_1'), kept(null)],
      });

      await expect(pools.provisioning()).resolves.toEqual([
        expect.objectContaining({ poolId: 'pool_spotlight', egress: true }),
        expect.objectContaining({ poolId: 'pool_egress_1', egress: true }),
        expect.objectContaining({ poolId: 'pool_none', egress: false }),
      ]);
    });

    it('counts the platform egress only where the deployment has one', async () => {
      const { pools } = pooling(null, {
        provisioning: [kept('spotlight'), kept('egress_1')],
        platform: false,
      });

      await expect(pools.provisioning()).resolves.toEqual([
        expect.objectContaining({ poolId: 'pool_spotlight', egress: false }),
        expect.objectContaining({ poolId: 'pool_egress_1', egress: true }),
      ]);
    });
  });

  describe('the room a pool has left', () => {
    it('is what maxRuns leaves beside the runners that are alive in it', async () => {
      const { pools } = pooling(null, { alive: [aRunner()] });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBe(1);
    });

    it('is unbounded for a pool without maxRuns', async () => {
      const { pools } = pooling(null, {
        pool: aPullPool(),
        alive: [aRunner(), aRunner({ id: 'pooled_2' })],
      });

      await expect(pools.roomIn(POOL_ID.value, NOW)).resolves.toBeNull();
    });

    it('is none for a pool that is gone or retired', async () => {
      await expect(
        pooling(null, { pool: null }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
      await expect(
        pooling(null, {
          pool: aPullPool().retire(attributedIn()),
        }).pools.roomIn(POOL_ID.value, NOW),
      ).resolves.toBe(0);
    });
  });
});
