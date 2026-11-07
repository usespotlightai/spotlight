import type { PairJudgePort } from '@replays/application/ports/pair-judge.port';
import type { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { SideBySideJudgingVersionConflictError } from '@replays/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface PairKey {
  readonly runId: RunId;
  readonly otherRunId: RunId;
}

const MAX_JUDGED_AT_ONCE = 4;

export class WorkSideBySideJudgings implements PendingJobsPort {
  readonly name = 'Judging changes side by side';

  readonly #loop: JobLoop<SideBySideJudging, PairKey>;

  constructor(
    private readonly judgings: SideBySideJudgingRepository,
    private readonly judge: PairJudgePort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<SideBySideJudging, PairKey>(
      {
        name: this.name,
        batchSize: MAX_JUDGED_AT_ONCE,
        due: (now) => this.judgings.nextDueJob(now),
        find: (key) => this.judgings.of(key.runId, key.otherRunId),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => ({
          runId: judging.runId,
          otherRunId: judging.otherRunId,
        }),
        ids: (judging) => ({
          workspaceId: judging.workspaceId.value,
          teamId: judging.teamId.value,
          runId: judging.runId.value,
        }),
        about: (judging) => ({
          otherRunId: judging.otherRunId.value,
          attempts: judging.job?.attempts,
        }),
        process: (judging) => this.judged(judging),
        stale: (error) =>
          error instanceof SideBySideJudgingVersionConflictError,
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

  private async judged(judging: SideBySideJudging): Promise<SideBySideJudging> {
    const judgment = await this.judge.judge({
      run: judging.runId,
      other: judging.otherRunId,
      reference: judging.reference,
      criteria: judging.criteria,
      orders: judging.orders,
    });

    return judging.recordJudgment(judgment, this.clock.now());
  }
}
