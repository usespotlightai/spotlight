import { JudgingError } from '@outcomes/application/errors/judging.error';
import type { EvidencePort } from '@outcomes/application/ports/evidence.port';
import type { PairJudgePort } from '@outcomes/application/ports/pair-judge.port';
import type {
  PairJudging,
  PairShown,
} from '@outcomes/domain/aggregates/pair-judging.aggregate';
import { PairJudgingVersionConflictError } from '@outcomes/domain/exceptions/pair-judging-version-conflict.error';
import type { PairJudgingRepository } from '@outcomes/domain/repositories/pair-judging.repository';
import { PairEvidence } from '@outcomes/domain/services/pair-evidence';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { PairOrder } from '@outcomes/domain/value-objects/pair-order';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

interface PairKey {
  readonly runId: RunId;
  readonly against: RunId;
}

const MOST_JUDGED_AT_ONCE = 4;

export class WorkPairJudgings implements OwedWorkPort {
  readonly name = 'Judging changes side by side';

  readonly #pool: OwedWorkPool<PairJudging, PairKey>;

  constructor(
    private readonly judgings: PairJudgingRepository,
    private readonly evidence: EvidencePort,
    private readonly judge: PairJudgePort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
  ) {
    this.#pool = new OwedWorkPool<PairJudging, PairKey>(
      {
        name: this.name,
        mostAtOnce: MOST_JUDGED_AT_ONCE,
        due: (now) => this.judgings.dueForWork(now),
        find: (key) => this.judgings.of(key.runId, key.against),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => ({
          runId: judging.runId,
          against: judging.against,
        }),
        ids: (judging) => ({
          workspaceId: judging.workspaceId.value,
          teamId: judging.teamId.value,
          runId: judging.runId.value,
        }),
        about: (judging) => ({
          against: judging.against.value,
          attempts: judging.work?.attempts,
        }),
        worked: (judging) => this.judged(judging),
        stale: (error) => error instanceof PairJudgingVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
    );
  }

  workDue(): Promise<void> {
    return this.#pool.workDue();
  }

  idle(): Promise<void> {
    return this.#pool.idle();
  }

  private async judged(judging: PairJudging): Promise<PairJudging> {
    if (!this.judge.available) {
      return judging.failed(JudgingFailure.of('unavailable', this.clock.now()));
    }

    const [run, against, reference] = await Promise.all([
      this.evidence.of(judging.runId.value),
      this.evidence.of(judging.against.value),
      this.evidence.of(judging.reference.value),
    ]);

    if (!run || !against || !reference) {
      return judging.failed(JudgingFailure.of('no-evidence', this.clock.now()));
    }

    const shownIn = (order: PairOrder) =>
      PairEvidence.of({
        run: { run: judging.runId, hunks: run.hunks },
        against: { run: judging.against, hunks: against.hunks },
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
    const readings: PairShown[] = [];

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

        spending = spending.usedModel(usage);
        readings.push({ verdict, evidence });
      }
    } catch (error) {
      return error instanceof JudgingError
        ? spending
            .usedModel(error.usage)
            .failed(JudgingFailure.of(error.trouble, this.clock.now()))
        : spending.triedAgainLater(this.clock.now());
    }

    return spending.judged({
      readings,
      model: this.judge.model,
      now: this.clock.now(),
    });
  }
}
