import type { ChangeJudgePort } from '@replays/application/ports/change-judge.port';
import type { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@replays/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface JudgingKey {
  readonly runId: RunId;
  readonly attempt: JudgingAttempt;
}

const MAX_JUDGED_AT_ONCE = 4;

export class WorkChangeJudgings implements PendingJobsPort {
  readonly name = 'Judging changes';

  readonly #loop: JobLoop<ChangeJudging, JudgingKey>;

  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly judge: ChangeJudgePort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<ChangeJudging, JudgingKey>(
      {
        name: this.name,
        batchSize: MAX_JUDGED_AT_ONCE,
        due: (now) => this.judgings.nextDueJob(now),
        find: (key) => this.judgings.of(key.runId, key.attempt),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => ({
          runId: judging.runId,
          attempt: judging.attempt,
        }),
        ids: (judging) => ({
          workspaceId: judging.workspaceId.value,
          teamId: judging.teamId.value,
          runId: judging.runId.value,
        }),
        about: (judging) => ({
          attempt: judging.attempt,
          attempts: judging.job?.attempts,
        }),
        process: (judging) => this.judged(judging),
        stale: (error) => error instanceof ChangeJudgingVersionConflictError,
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

  private async judged(judging: ChangeJudging): Promise<ChangeJudging> {
    const judgment = await this.judge.judge({
      workspaceId: judging.workspaceId.value,
      run: judging.runId,
      criteria: judging.criteria,
      reference: judging.reference,
      guidanceRequested: judging.guidanceRequested,
    });

    return judging.recordJudgment(judgment, this.clock.now());
  }
}
