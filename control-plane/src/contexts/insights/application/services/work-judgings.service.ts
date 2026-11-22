import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type { SettledSession } from '@insights/application/ports/session-outcomes';
import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import { JudgingFailure } from '@shared-kernel/domain/value-objects/judging-failure.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MAX_JUDGED_AT_ONCE = 4;

export class WorkJudgings implements PendingJobsPort {
  readonly name = 'Judging runs';

  readonly #loop: JobLoop<Judging, RunId>;

  constructor(
    private readonly judgings: JudgingRepository,
    private readonly evidence: EvidencePort,
    private readonly judge: JudgePort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<Judging, RunId>(
      {
        name: this.name,
        batchSize: MAX_JUDGED_AT_ONCE,
        due: (now) => this.judgings.nextDueJob(now),
        find: (runId) => this.judgings.of(runId),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => judging.runId,
        ids: (judging) => ({
          workspaceId: judging.workspaceId.value,
          runId: judging.runId.value,
        }),
        about: (judging) => ({
          attempts: judging.job?.attempts,
        }),
        process: (judging) => this.judged(judging),
        stale: (error) => error instanceof JudgingVersionConflictError,
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

    if (round?.of !== 'judging') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const judging = await this.judgings.of(round.round.runId);

      if (!judging || judging.workspaceId.value !== session.workspaceId) {
        return;
      }

      const woken = judging.wake(round.round, this.clock.now());

      if (woken === judging) {
        return;
      }

      try {
        await this.judgings.save(woken);
      } catch (error) {
        if (!(error instanceof JudgingVersionConflictError)) {
          throw error;
        }
      }
    });
  }

  private async judged(judging: Judging): Promise<Judging> {
    const run = await this.evidence.of(judging.runId);

    if (!run) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    const evidence = JudgeEvidence.of({
      runId: judging.runId,
      title: run.title,
      description: run.description,
      steps: run.steps,
      hunks: run.hunks,
    });

    if (evidence.isEmpty) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    const answer = await this.judge.judge({
      workspaceId: judging.workspaceId.value,
      round: { of: 'judging', round: judging.round },
      claims: judging.rubric.claims,
      title: evidence.title,
      description: evidence.description,
      steps: evidence.steps,
      stepsLeftOut: evidence.stepsLeftOut,
      hunks: evidence.hunks,
      hunksLeftOut: evidence.hunksLeftOut,
      reference: null,
      guidanceRequested: false,
      effectsBlocked: false,
    });

    switch (answer.status) {
      case 'waiting':
        return judging.waitJob(this.clock.now());
      case 'failed':
        return judging.failed(
          JudgingFailure.of(answer.failure, this.clock.now()),
        );
      case 'judged':
        return judging.recordVerdict({
          verdict: answer.verdict,
          evidence,
          model: answer.model,
          now: this.clock.now(),
        });
    }
  }
}
