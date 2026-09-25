import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export const reviseRunner = async (
  runners: RunnerRepository,
  id: RunnerId,
  change: (runner: Runner) => Runner,
): Promise<Runner | null> => {
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
      if (!(error instanceof RunnerMovedOnError) || attempt >= ATTEMPTS) {
        throw error;
      }
    }
  }
};
