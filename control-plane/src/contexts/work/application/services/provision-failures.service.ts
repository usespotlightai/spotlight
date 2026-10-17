import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { PROVISION_FAILED } from '@work/application/contracts/run-journal.contract';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

const ATTEMPTS = 3;

export class ProvisionFailures {
  constructor(
    private readonly runs: RunRepository,
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async failed(
    runId: RunId,
    runner: RunnerId,
    failure: ProvisionFailure,
    at: Date,
  ): Promise<Run | null> {
    const failed = await this.revised(runId, (run) =>
      run.provisionFailed(runner, failure, at),
    );

    if (!failed) {
      return null;
    }

    const entry = {
      seq: -failed.provisioning.failures,
      type: PROVISION_FAILED,
      message: `Provisioning failed · ${failure.kind}`,
      data: Buffer.from(failure.detail, 'utf8').toString('base64'),
    };

    await this.journal.append(RunAttempt.of(failed.id, failed.attempt), [
      { ...entry, at },
    ]);
    this.stream.publish(failed.id.value, [
      { ...entry, attempt: failed.attempt, at: at.toISOString() },
    ]);

    return failed;
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
