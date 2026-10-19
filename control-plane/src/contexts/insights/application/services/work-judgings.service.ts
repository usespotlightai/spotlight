import { JudgingError } from '@insights/application/errors/judging.error';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
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
    transaction: TransactionPort,
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

  private async judged(judging: Judging): Promise<Judging> {
    const run = await this.evidence.of(judging.runId.value);

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

    try {
      const { verdict } = await this.judge.judge({
        rubric: judging.rubric.text,
        claims: judging.rubric.criteria.claims,
        scale: judging.rubric.scale.kind,
        title: evidence.title,
        description: evidence.description,
        steps: evidence.steps,
        stepsLeftOut: evidence.stepsLeftOut,
        hunks: evidence.hunks,
        hunksLeftOut: evidence.hunksLeftOut,
        reference: null,
        guidanceRequested: false,
      });

      return judging.recordVerdict({
        verdict,
        evidence,
        model: this.judge.model,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof JudgingError) {
        return judging.failed(JudgingFailure.of(error.kind, this.clock.now()));
      }
      throw error;
    }
  }
}
