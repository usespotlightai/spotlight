import type { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import type { RedraftChangeStack } from '@change-review/application/services/redraft-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';

const MAX_STACKS_AT_ONCE = 4;

export class WorkChangeStacks implements PendingJobsPort {
  readonly name = 'Generating and redrafting change stacks';

  readonly #loop: JobLoop<ChangeStack, ChangeStackId>;

  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly checks: StackCheckRepository,
    transaction: TransactionPort,
    private readonly generating: GenerateChangeStack,
    private readonly redrafting: RedraftChangeStack,
    clock: ClockPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<ChangeStack, ChangeStackId>(
      {
        name: this.name,
        batchSize: MAX_STACKS_AT_ONCE,
        due: (now) => this.stacks.nextDueJob(now),
        find: (id) => this.stacks.find(id),
        save: (stack) => this.stacks.save(stack),
        keyOf: (stack) => stack.id,
        ids: (stack) => ({
          workspaceId: stack.workspaceId.value,
          taskId: stack.taskId?.value,
          runId: stack.runId.value,
        }),
        about: (stack) => ({
          changeStackId: stack.id.value,
          state: stack.state,
          attempts: stack.job.attempts,
        }),
        process: (stack) => this.processed(stack),
        stale: (error) => error instanceof ChangeStackVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async processed(stack: ChangeStack): Promise<ChangeStack> {
    if (stack.state === 'generating') {
      return this.generating.generated(stack);
    }

    const check = await this.checks.find(stack.id, false);

    return check
      ? this.redrafting.redrafted(stack, check)
      : stack.stopRedrafting();
  }
}
