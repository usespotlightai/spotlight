import type { ChangeJudgePort } from '@replays/application/ports/change-judge.port';
import type { SettledSession } from '@replays/application/ports/session-outcomes';
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
    private readonly transaction: TransactionPort,
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

  /** Makes the judging that waits on a settled session due now; a judging that moved on meanwhile is left alone. */
  async sessionSettled(session: SettledSession): Promise<void> {
    const round = this.judge.roundOf(session);

    if (!round) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const judging = await this.judgings.of(round.runId, round.judging);

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
        if (!(error instanceof ChangeJudgingVersionConflictError)) {
          throw error;
        }
      }
    });
  }

  private async judged(judging: ChangeJudging): Promise<ChangeJudging> {
    const judgment = await this.judge.judge({
      workspaceId: judging.workspaceId.value,
      round: judging.round,
      criteria: judging.criteria,
      reference: judging.reference,
      guidanceRequested: judging.guidanceRequested,
    });

    return 'status' in judgment
      ? judging.waitJob(this.clock.now())
      : judging.recordJudgment(judgment, this.clock.now());
  }
}
