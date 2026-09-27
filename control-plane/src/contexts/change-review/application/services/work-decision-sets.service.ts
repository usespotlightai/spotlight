import type { DecisionDrafterPort } from '@change-review/application/ports/decision-drafter.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionGrounds } from '@change-review/domain/value-objects/decision-grounds.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MOST_SETS_AT_ONCE = 4;

export class WorkDecisionSets implements OwedWorkPort {
  readonly name = 'Drafting decisions';

  readonly #pool: OwedWorkPool<DecisionSet, TaskId>;

  constructor(
    private readonly sets: DecisionSetRepository,
    private readonly work: WorkPort,
    private readonly drafter: DecisionDrafterPort,
    private readonly ids: IdGeneratorPort,
    transaction: TransactionPort,
    clock: ClockPort,
    logger: LoggerPort,
  ) {
    this.#pool = new OwedWorkPool<DecisionSet, TaskId>(
      {
        name: this.name,
        mostAtOnce: MOST_SETS_AT_ONCE,
        due: (now) => this.sets.dueForWork(now),
        find: (taskId) => this.sets.forTask(taskId),
        save: (set) => this.sets.save(set),
        keyOf: (set) => set.taskId,
        about: (set) => ({
          taskId: set.taskId.value,
          runId: set.draft?.runId.value,
          attempts: set.draft?.work.attempts,
        }),
        worked: (set) => this.drafted(set),
        stale: (error) => error instanceof ChangedSinceReadError,
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

  private async drafted(set: DecisionSet): Promise<DecisionSet> {
    if (!set.draft) {
      return set;
    }

    const { runId } = set.draft;
    const reasoning = await this.work.reasoning(runId);

    if (!reasoning) {
      return set.gaveUp();
    }

    const proposed =
      reasoning.steps.length > 0 && reasoning.changed.length > 0
        ? await this.drafter.draft(reasoning)
        : [];

    return set.drafted({
      runId,
      proposed,
      grounds: DecisionGrounds.of({
        steps: reasoning.steps.map((each) => each.index),
        changed: reasoning.changed,
      }),
      newId: () => this.ids.generate(),
    });
  }
}
