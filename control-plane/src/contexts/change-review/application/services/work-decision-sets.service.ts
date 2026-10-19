import type { DecisionGeneratorPort } from '@change-review/application/ports/decision-generator.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionEvidence } from '@change-review/domain/value-objects/decision-evidence.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MAX_SETS_AT_ONCE = 4;

export class WorkDecisionSets implements PendingJobsPort {
  readonly name = 'Generating decisions';

  readonly #loop: JobLoop<DecisionSet, TaskId>;

  constructor(
    private readonly sets: DecisionSetRepository,
    private readonly work: WorkPort,
    private readonly generator: DecisionGeneratorPort,
    private readonly ids: IdGeneratorPort,
    transaction: TransactionPort,
    clock: ClockPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<DecisionSet, TaskId>(
      {
        name: this.name,
        batchSize: MAX_SETS_AT_ONCE,
        due: (now) => this.sets.nextDueJob(now),
        find: (taskId) => this.sets.forTask(taskId),
        save: (set) => this.sets.save(set),
        keyOf: (set) => set.taskId,
        ids: (set) => ({
          workspaceId: set.workspaceId.value,
          taskId: set.taskId.value,
          runId: set.generation?.runId.value,
        }),
        about: (set) => ({
          attempts: set.generation?.job.attempts,
        }),
        process: (set) => this.generated(set),
        stale: (error) => error instanceof DecisionSetVersionConflictError,
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

  private async generated(set: DecisionSet): Promise<DecisionSet> {
    if (!set.generation) {
      return set;
    }

    const { runId } = set.generation;
    const reasoning = await this.work.reasoning(runId);

    if (!reasoning) {
      return set.deadLetter();
    }

    const proposed =
      reasoning.steps.length > 0 && reasoning.changed.length > 0
        ? await this.generator.generate(reasoning)
        : [];

    return set.recordGeneration({
      runId,
      proposed,
      evidence: DecisionEvidence.of({
        steps: reasoning.steps.map((each) => each.index),
        changed: reasoning.changed,
      }),
      newId: () => this.ids.generate(),
    });
  }
}
