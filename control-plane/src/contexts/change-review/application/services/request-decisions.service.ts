import type { DecisionGeneratorPort } from '@change-review/application/ports/decision-generator.port';
import type {
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { decidesFrom } from '@change-review/domain/services/decision-policy';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class RequestDecisions {
  constructor(
    private readonly work: WorkPort,
    private readonly sets: DecisionSetRepository,
    private readonly generator: DecisionGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async runEnded(
    taskId: TaskId,
    runId: RunId,
    handsOver: boolean,
  ): Promise<void> {
    const run = await this.work.run(runId);

    if (run) {
      await this.requested(taskId, run, run.attempt, handsOver);
    }
  }

  async turnAwaited(
    taskId: TaskId,
    runId: RunId,
    attempt: number,
    handsOver: boolean,
  ): Promise<void> {
    const run = await this.work.run(runId);

    if (run) {
      await this.requested(taskId, run, attempt, handsOver);
    }
  }

  private async requested(
    taskId: TaskId,
    run: RunForReview,
    attempt: number,
    handsOver: boolean,
  ): Promise<void> {
    const task = await this.work.task(taskId);

    if (
      !task ||
      !run.orderedAt ||
      !decidesFrom(run, handsOver, task) ||
      !(await this.generator.availableTo(task.workspaceId.value))
    ) {
      return;
    }

    const turn = AgentTurn.of(run.id, attempt, run.orderedAt);

    await this.transaction.inTransaction(async () => {
      const now = this.clock.now();
      const existing = await this.sets.forTask(taskId);

      if (existing) {
        await this.sets.save(existing.requestGeneration(turn, now));
        return;
      }

      await this.sets.add(
        DecisionSet.open({
          id: DecisionSetId.of(this.ids.generate()),
          taskId,
          workspaceId: task.workspaceId,
        }).requestGeneration(turn, now),
      );
    });
  }
}
