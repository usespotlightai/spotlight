import type { TaskDraftStatesPort } from '@work/application/ports/task-draft-states.port';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';

export class DeleteTaskDraft {
  constructor(private readonly states: TaskDraftStatesPort) {}

  async on(event: TaskDeleted): Promise<void> {
    await this.states.forget(event.taskId);
  }
}
