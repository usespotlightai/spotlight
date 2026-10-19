import { JudgingError } from '@insights/application/errors/judging.error';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { SideBySideJudgePort } from '@insights/application/ports/side-by-side-judge.port';
import type {
  PairShown,
  SideBySideJudging,
} from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import { SideBySideJudgingVersionConflictError } from '@insights/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { SideBySideJudgingRepository } from '@insights/domain/repositories/side-by-side-judging.repository';
import { PairEvidence } from '@insights/domain/services/pair-evidence';
import { JudgingFailure } from '@insights/domain/value-objects/judging-failure.vo';
import type { PairOrder } from '@insights/domain/value-objects/pair-order';
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
    private readonly evidence: EvidencePort,
    private readonly judge: SideBySideJudgePort,
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
    if (!this.judge.available) {
      return judging.failed(JudgingFailure.of('unavailable', this.clock.now()));
    }

    const [run, other, reference] = await Promise.all([
      this.evidence.of(judging.runId.value),
      this.evidence.of(judging.otherRunId.value),
      this.evidence.of(judging.reference.value),
    ]);

    if (!run || !other || !reference) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    const shownIn = (order: PairOrder) =>
      PairEvidence.of({
        run: { run: judging.runId, hunks: run.hunks },
        other: { run: judging.otherRunId, hunks: other.hunks },
        order,
        title: run.title,
        description: run.description,
        reference: reference.hunks,
      });
    const shown = judging.orders.map(shownIn);

    if (shown.some((each) => each.isEmpty)) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    let spending = judging;
    const passes: PairShown[] = [];

    try {
      for (const evidence of shown) {
        const { reference } = evidence;

        if (!reference) {
          return spending.failed(
            JudgingFailure.of('no-evidence', this.clock.now()),
          );
        }

        const { verdict, usage } = await this.judge.judgePair({
          rubric: judging.criteria.rubric,
          claims: judging.criteria.claims,
          title: evidence.title,
          description: evidence.description,
          a: evidence.a,
          b: evidence.b,
          reference,
        });

        spending = spending.recordModel(usage);
        passes.push({ verdict, evidence });
      }
    } catch (error) {
      return error instanceof JudgingError
        ? spending
            .recordModel(error.usage)
            .failed(JudgingFailure.of(error.kind, this.clock.now()))
        : spending.scheduleRetry(this.clock.now());
    }

    return spending.recordVerdict({
      passes: passes,
      model: this.judge.model,
      now: this.clock.now(),
    });
  }
}
