import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ReplaySetEntry {
  private constructor(
    readonly runId: RunId,
    readonly taskId: TaskId,
    readonly addedAt: Date,
  ) {}

  static of(input: {
    runId: RunId;
    taskId: TaskId;
    addedAt: Date;
  }): ReplaySetEntry {
    return new ReplaySetEntry(input.runId, input.taskId, input.addedAt);
  }

  equals(other: ReplaySetEntry): boolean {
    return (
      this.runId.equals(other.runId) &&
      this.taskId.equals(other.taskId) &&
      this.addedAt.getTime() === other.addedAt.getTime()
    );
  }
}
