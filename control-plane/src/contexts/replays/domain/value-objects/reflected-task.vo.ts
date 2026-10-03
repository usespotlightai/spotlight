import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ReflectedTask {
  private constructor(
    readonly taskId: TaskId,
    readonly originalRunId: RunId,
    readonly replayRunId: RunId,
  ) {}

  static of(input: {
    taskId: TaskId;
    originalRunId: RunId;
    replayRunId: RunId;
  }): ReflectedTask {
    return new ReflectedTask(
      input.taskId,
      input.originalRunId,
      input.replayRunId,
    );
  }

  isAbout(taskId: TaskId): boolean {
    return this.taskId.equals(taskId);
  }
}
