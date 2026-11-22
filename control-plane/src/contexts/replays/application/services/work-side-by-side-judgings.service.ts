import type { PairJudgePort } from '@replays/application/ports/pair-judge.port';
import type { SettledSession } from '@replays/application/ports/session-outcomes';
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
    private readonly transaction: TransactionPort,
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

  /** Makes the judging that waits on a settled session due now; a judging that moved on meanwhile is left alone. */
  async sessionSettled(session: SettledSession): Promise<void> {
    const round = this.judge.roundOf(session);

    if (!round) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const judging = await this.judgings.of(round.runId, round.otherRunId);

      if (!judging || judging.workspaceId.value !== session.workspaceId) {
        return;
      }

      const woken = judging.wake(round, this.clock.now());

      if (woken === judging) {
        return;
      }

      try {
        await this.judgings.save(woken);
      } catch (error) {
        if (!(error instanceof SideBySideJudgingVersionConflictError)) {
          throw error;
        }
      }
    });
  }

  private async judged(judging: SideBySideJudging): Promise<SideBySideJudging> {
    const judgment = await this.judge.judge({
      workspaceId: judging.workspaceId.value,
      round: judging.round,
      reference: judging.reference,
      criteria: judging.criteria,
      orders: judging.orders,
    });

    return 'status' in judgment
      ? judging.waitJob(this.clock.now())
      : judging.recordJudgment(judgment, this.clock.now());
  }
}
