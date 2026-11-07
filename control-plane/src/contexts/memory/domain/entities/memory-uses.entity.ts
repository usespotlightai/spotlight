import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface UsingRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
}

export class MemoryUses {
  private constructor(
    readonly run: UsingRun,
    readonly via: MemoryUse,
    readonly memories: readonly MemoryId[],
    readonly at: Date,
  ) {}

  static of(input: {
    run: UsingRun;
    via: MemoryUse;
    memories: readonly MemoryId[];
    at: Date;
  }): MemoryUses | null {
    const { run, via, memories, at } = input;

    return memories.length === 0
      ? null
      : new MemoryUses(run, via, memories, at);
  }

  usedFirst(inserted: readonly MemoryId[]): MemoriesUsed | null {
    const used = this.memories.filter((each) =>
      inserted.some((one) => one.equals(each)),
    );

    return used.length === 0
      ? null
      : new MemoriesUsed(
          this.run.id,
          this.run.workspaceId,
          this.run.taskId,
          this.via,
          used,
        );
  }
}
