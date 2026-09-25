import type {
  AdmittedHost,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
import type { RunnerResourcesPort } from '@runners/application/ports/runner-resources.port';
import { RunnerPools } from '@runners/application/services/runner-pools.service';
import {
  aPullPool,
  POOL_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const pooling = (admitted: AdmittedHost | null) => {
  const admit = vi.fn(async () => admitted);
  const find = vi.fn(async () => aPullPool({ maxRuns: 2 }));

  const pools = new RunnerPools(
    { find } as unknown as RunnerPoolRepository,
    {} as RunnerRepository,
    {} as RunnerResourcesPort,
    { admit } satisfies RunnerAdmissionsPort,
  );

  return { pools, admit, find };
};

describe('RunnerPools', () => {
  describe('the pool a token pulls with', () => {
    it('answers the pool the admissions let the token in through, at work', async () => {
      const { pools, admit } = pooling({
        way: { kind: 'pool', id: POOL_ID.value },
        workspaceId: WORKSPACE,
      });

      await expect(pools.pulledWith('pool-token')).resolves.toEqual({
        poolId: POOL_ID.value,
        workspaceId: WORKSPACE,
        key: 'ephemeral',
        labels: expect.objectContaining({ values: ['linux'] }),
        maxRuns: 2,
      });
      expect(admit).toHaveBeenCalledWith({
        bearer: 'pool-token',
        trust: undefined,
      });
    });

    it('answers no pool where the admissions let nothing in', async () => {
      const { pools, find } = pooling(null);

      await expect(pools.pulledWith('stolen')).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });

    it('answers no pool for a way in that is a trust', async () => {
      const { pools, find } = pooling({
        way: { kind: 'trust', id: 'trust_1' },
        workspaceId: WORKSPACE,
      });

      await expect(pools.pulledWith('workload-token')).resolves.toBeNull();
      expect(find).not.toHaveBeenCalled();
    });
  });
});
