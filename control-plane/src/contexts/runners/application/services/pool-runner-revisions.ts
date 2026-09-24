import type { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import { PoolRunnerMovedOnError } from '@runners/domain/exceptions/pool-runner-moved-on.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export const revisePoolRunner = async (
  runners: PoolRunnerRepository,
  id: RunnerId,
  change: (runner: PoolRunner) => PoolRunner,
): Promise<PoolRunner | null> => {
  for (let attempt = 1; ; attempt++) {
    const found = await runners.find(id);
    if (!found) {
      return null;
    }

    const changed = change(found);

    if (changed === found) {
      return found;
    }

    try {
      await runners.save(changed);
      return changed;
    } catch (error) {
      if (!(error instanceof PoolRunnerMovedOnError) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
};
