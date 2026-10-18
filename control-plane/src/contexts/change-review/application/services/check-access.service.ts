import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckAccessPort } from '@work/application/ports/check-access.port';

export class CheckAccess implements CheckAccessPort {
  constructor(private readonly checks: StackCheckRepository) {}

  async isCheckOfRunLeasedBy(
    runId: RunId,
    runner: RunnerId,
    now: Date,
  ): Promise<boolean> {
    return (await this.checks.ofRun(runId)).some((check) =>
      check.beingCheckedBy(runner, now),
    );
  }
}
