import type { DecisionDrafterPort } from '@change-review/application/ports/decision-drafter.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class AskForDecisions {
  constructor(
    private readonly work: WorkPort,
    private readonly sets: DecisionSetRepository,
    private readonly drafter: DecisionDrafterPort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async runEnded(taskId: TaskId, runId: RunId): Promise<void> {
    if (!this.drafter.available) {
      return;
    }

    const run = await this.work.run(runId);

    if (!run?.decisions || !run.completed) {
      return;
    }

    const task = await this.work.task(taskId);

    if (!task || task.reviewing) {
      return;
    }

    await this.transaction.run(async () => {
      const now = this.clock.now();
      const held = await this.sets.forTask(taskId);

      if (held) {
        await this.sets.save(held.asked(runId, now));
        return;
      }

      await this.sets.add(
        DecisionSet.opened({
          id: DecisionSetId.of(this.ids.generate()),
          taskId,
          workspaceId: task.workspaceId,
        }).asked(runId, now),
      );
    });
  }
}
