import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import { checkFor } from '@memory/domain/services/duplicate-comparison';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DuplicateCheckReactions {
  constructor(
    private readonly sets: MemoryProposalSetRepository,
    private readonly checks: DuplicateCheckRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Opens the duplicate check of a run that proposed memories to compare, once per run: when the run ends, or
   * earlier, when it stops to wait for a person, who may review its proposals meanwhile.
   */
  async onRunEnded(run: { id: RunId; taskId: TaskId | null }): Promise<void> {
    if (!run.taskId) {
      return;
    }

    const set = await this.sets.forTask(run.taskId);
    const check =
      set && checkFor({ set, runId: run.id, now: this.clock.now() });

    if (!check) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      if (!(await this.checks.of(run.id))) {
        await this.checks.add(check);
      }
    });
  }

  /** Removes the checks of a deleted task's runs, one at a time. */
  async onTaskDeleted(taskId: TaskId): Promise<void> {
    for (const check of await this.checks.ofTask(taskId)) {
      await this.transaction.inTransaction(() =>
        this.checks.save(check.delete()),
      );
    }
  }
}
