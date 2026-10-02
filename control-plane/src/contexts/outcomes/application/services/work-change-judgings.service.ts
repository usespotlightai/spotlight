import { JudgingError } from '@outcomes/application/errors/judging.error';
import type { EvidencePort } from '@outcomes/application/ports/evidence.port';
import type { JudgePort } from '@outcomes/application/ports/judge.port';
import type { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import { ChangeJudgingMovedOnError } from '@outcomes/domain/exceptions/change-judging-moved-on.error';
import type { ChangeJudgingRepository } from '@outcomes/domain/repositories/change-judging.repository';
import { JudgeEvidence } from '@outcomes/domain/services/judge-evidence';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MOST_JUDGED_AT_ONCE = 4;

export class WorkChangeJudgings implements OwedWorkPort {
  readonly name = 'Judging changes';

  readonly #pool: OwedWorkPool<ChangeJudging, RunId>;

  constructor(
    private readonly judgings: ChangeJudgingRepository,
    private readonly evidence: EvidencePort,
    private readonly judge: JudgePort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) {
    this.#pool = new OwedWorkPool<ChangeJudging, RunId>(
      {
        name: this.name,
        mostAtOnce: MOST_JUDGED_AT_ONCE,
        due: (now) => this.judgings.dueForWork(now),
        find: (runId) => this.judgings.of(runId),
        save: (judging) => this.judgings.save(judging),
        keyOf: (judging) => judging.runId,
        about: (judging) => ({
          runId: judging.runId.value,
          attempts: judging.work?.attempts,
        }),
        worked: (judging) => this.judged(judging),
        stale: (error) => error instanceof ChangeJudgingMovedOnError,
      },
      transaction,
      clock,
      logger,
    );
  }

  workDue(): Promise<void> {
    return this.#pool.workDue();
  }

  idle(): Promise<void> {
    return this.#pool.idle();
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
        rubric: judging.rubric,
        scale: judging.scale.kind,
        title: evidence.title,
        description: evidence.description,
        steps: evidence.steps,
        stepsLeftOut: evidence.stepsLeftOut,
        hunks: evidence.hunks,
        hunksLeftOut: evidence.hunksLeftOut,
        reference: evidence.reference,
      });

      return judging.judged({
        verdict,
        usage,
        evidence,
        model: this.judge.model,
        now: this.clock.now(),
      });
    } catch (error) {
      if (error instanceof JudgingError) {
        return judging
          .usedModel(error.usage)
          .failed(JudgingFailure.of(error.trouble, this.clock.now()));
      }
      throw error;
    }
  }
}
