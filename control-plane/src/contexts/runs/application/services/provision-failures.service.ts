import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export class ProvisionFailures {
  constructor(private readonly runs: RunRepository) {}

  async failed(
    runId: RunId,
    runner: RunnerId,
    failure: ProvisionFailure,
    at: Date,
  ): Promise<Run | null> {
    return this.revised(runId, (run) =>
      run.provisionFailed(runner, failure, at),
    );
  }

  async unreserved(runId: RunId, runner: RunnerId): Promise<void> {
    await this.revised(runId, (run) => run.unreservedFor(runner));
  }

  private async revised(
    runId: RunId,
    change: (run: Run) => Run,
  ): Promise<Run | null> {
    for (let attempt = 1; ; attempt++) {
      const found = await this.runs.findById(runId);
      const changed = found ? change(found) : null;

      if (!changed || changed === found) {
        return null;
      }

      try {
        await this.runs.save(changed);
        return changed;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
