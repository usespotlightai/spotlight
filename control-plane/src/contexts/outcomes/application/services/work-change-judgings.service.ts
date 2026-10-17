import { JudgingError } from '@outcomes/application/errors/judging.error';
import type { EvidencePort } from '@outcomes/application/ports/evidence.port';
import type { JudgePort } from '@outcomes/application/ports/judge.port';
import type { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@outcomes/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@outcomes/domain/repositories/change-judging.repository';
import { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { JudgingRound } from '@outcomes/domain/value-objects/judging-round';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface JudgingKey {
  readonly runId: RunId;
  readonly round: JudgingRound;
}

const MAX_JUDGED_AT_ONCE = 4;

export class WorkChangeJudgings implements PendingJobsPort {
  readonly name = 'Judging changes';

  readonly #loop: JobLoop<ChangeJudging, JudgingKey>;

  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly evidence: EvidencePort,
    private readonly judge: JudgePort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
  ) {
    this.#loop = new JobLoop<ChangeJudging, JudgingKey>(
      {
        name: this.name,
        batchSize: MAX_JUDGED_AT_ONCE,
        due: (now) => this.judgings.nextDueJob(now),
        find: (key) => this.judgings.of(key.runId, key.round),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => ({ runId: judging.runId, round: judging.round }),
        ids: (judging) => ({
          workspaceId: judging.workspaceId.value,
          teamId: judging.teamId.value,
          runId: judging.runId.value,
        }),
        about: (judging) => ({
          round: judging.round,
          attempts: judging.job?.attempts,
        }),
        process: (judging) => this.judged(judging),
        stale: (error) => error instanceof ChangeJudgingVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async judged(judging: ChangeJudging): Promise<ChangeJudging> {
    if (!this.judge.available) {
      return judging.failed(JudgingFailure.of('unavailable', this.clock.now()));
    }

    const [run, reference] = await Promise.all([
      this.evidence.of(judging.runId.value),
      judging.reference ? this.evidence.of(judging.reference.value) : null,
    ]);

    if (!run) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    const own = JudgeEvidence.of({
      runId: judging.runId,
      title: run.title,
      description: run.description,
      steps: run.steps,
      hunks: run.hunks,
    });
    const evidence = reference ? own.against(reference.hunks) : own;

    if (evidence.isEmpty) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    try {
      const { verdict, usage } = await this.judge.judge({
        rubric: judging.criteria.rubric,
        claims: judging.criteria.claims,
        scale: judging.scale.kind,
        title: evidence.title,
        description: evidence.description,
        steps: evidence.steps,
        stepsLeftOut: evidence.stepsLeftOut,
        hunks: evidence.hunks,
        hunksLeftOut: evidence.hunksLeftOut,
        reference: evidence.reference,
      });

      return judging.recordVerdict({
        verdict,
        usage,
        evidence,
        model: this.judge.model,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof JudgingError) {
        return judging
          .recordModel(error.usage)
          .failed(JudgingFailure.of(error.kind, this.clock.now()));
      }
      throw error;
    }
  }
}
