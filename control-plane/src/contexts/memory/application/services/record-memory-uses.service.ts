import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface UsingRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
}

export class RecordMemoryUses {
  constructor(
    private readonly uses: MemoryUsesPort,
    private readonly events: DomainEventDispatcher,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  recorded(
    run: UsingRun,
    way: MemoryUse,
    memories: readonly MemoryId[],
  ): Promise<void> {
    if (memories.length === 0) {
      return Promise.resolve();
    }

    return this.transaction.run(async () => {
      await this.uses.record(run.id, way, memories, this.clock.now());
      await this.events.dispatch([
        new MemoriesUsed(run.id, run.workspaceId, run.taskId, way, memories),
      ]);
    });
  }
}
