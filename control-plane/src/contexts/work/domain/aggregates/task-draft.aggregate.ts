import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';

export class TaskDraft {
  private constructor(
    readonly taskId: TaskId,
    readonly generation: DraftGeneration,
    readonly storedGeneration: DraftGeneration,
  ) {}

  static opened(taskId: TaskId): TaskDraft {
    return new TaskDraft(
      taskId,
      DraftGeneration.first(),
      DraftGeneration.first(),
    );
  }

  static rehydrate(input: {
    taskId: TaskId;
    generation: DraftGeneration;
  }): TaskDraft {
    return new TaskDraft(input.taskId, input.generation, input.generation);
  }

  sent(generation: DraftGeneration): TaskDraft {
    if (!generation.equals(this.generation)) {
      throw new DraftAlreadySentError(this.taskId.value);
    }

    return new TaskDraft(this.taskId, generation.next(), this.storedGeneration);
  }
}
