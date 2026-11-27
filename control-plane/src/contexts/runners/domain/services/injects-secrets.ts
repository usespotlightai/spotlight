import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';

export const injectsSecrets = (
  pools: readonly RunnerPool[],
  trusts: readonly RunnerTrust[],
  setup: {
    readonly platformPoolSet: boolean;
    readonly platformEgressSet: boolean;
  },
): boolean =>
  pools.some((each) => each.injectsSecrets(setup)) ||
  trusts.some((each) => each.injectsSecrets);
