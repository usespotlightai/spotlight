import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { draftsMemoriesAfter } from '@memory/domain/services/memory-drafting-policy';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class AskForMemories {
  constructor(
    private readonly work: WorkPort,
    private readonly drafts: MemoryDraftRepository,
    private readonly drafter: MemoryDrafterPort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async runEnded(taskId: TaskId, runId: RunId): Promise<void> {
    if (!this.drafter.available) {
      return;
    }

    const run = await this.work.run(runId);

    if (!run || !draftsMemoriesAfter(run)) {
      return;
    }

    const task = await this.work.task(taskId);

    if (!task) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const now = this.clock.now();
      const held = await this.drafts.forTask(taskId);

      if (held) {
        const asked = held.asked(runId, now);

        if (asked !== held) {
          await this.drafts.save(asked);
        }
        return;
      }

      await this.drafts.add(
        MemoryDraft.open({
          id: MemoryDraftId.of(this.ids.generate()),
          taskId,
          workspaceId: task.workspaceId,
        }).asked(runId, now),
      );
    });
  }
}
