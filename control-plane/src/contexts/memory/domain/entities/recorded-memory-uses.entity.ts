import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUse } from '@memory/domain/value-objects/memory-use';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface UsingRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly taskId: TaskId | null;
}

export class RecordedMemoryUses extends EventRecorder {
  private constructor(
    readonly runId: RunId,
    readonly via: MemoryUse,
    readonly memories: readonly MemoryId[],
    readonly at: Date,
  ) {
    super();
  }

  static of(input: {
    run: UsingRun;
    via: MemoryUse;
    memories: readonly MemoryId[];
    at: Date;
  }): RecordedMemoryUses | null {
    const { run, via, memories, at } = input;

    if (memories.length === 0) {
      return null;
    }

    const recorded = new RecordedMemoryUses(run.id, via, memories, at);
    recorded.record(
      new MemoriesUsed(run.id, run.workspaceId, run.taskId, via, memories),
    );
    return recorded;
  }
}
