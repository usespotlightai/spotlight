import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type {
  RememberedRun,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { draftsMemoriesAfter } from '@memory/domain/services/memory-drafting-policy';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { AgentTurn } from '@shared-kernel/domain/value-objects/agent-turn.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class RequestMemories {
  constructor(
    private readonly work: WorkPort,
    private readonly drafts: MemoryDraftRepository,
    private readonly drafter: MemoryDrafterPort,
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
    run: RememberedRun,
    attempt: number,
    handsOver: boolean,
  ): Promise<void> {
    const task = await this.work.task(taskId);

    if (
      !task ||
      !run.orderedAt ||
      !draftsMemoriesAfter(run, handsOver) ||
      !(await this.drafter.availableTo(task.workspaceId.value))
    ) {
      return;
    }

    const turn = AgentTurn.of(run.id, attempt, run.orderedAt);

    await this.transaction.inTransaction(async () => {
      const now = this.clock.now();
      const existing = await this.drafts.forTask(taskId);

      if (existing) {
        const requested = existing.requestDrafting(turn, now);

        if (requested !== existing) {
          await this.drafts.save(requested);
        }
        return;
      }

      await this.drafts.add(
        MemoryDraft.create({
          id: MemoryDraftId.of(this.ids.generate()),
          taskId,
          workspaceId: task.workspaceId,
        }).requestDrafting(turn, now),
      );
    });
  }
}
