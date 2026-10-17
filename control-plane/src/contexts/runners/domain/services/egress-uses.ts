import type { Egress } from '@runners/domain/aggregates/egress.aggregate';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';

export const poolsNaming = (
  egress: Egress,
  pools: readonly RunnerPool[],
): readonly PoolKey[] => {
  const reference = EgressReference.to(egress.id);

  return pools
    .filter((each) => each.goesOutThrough(reference))
    .map((each) => each.key);
};
