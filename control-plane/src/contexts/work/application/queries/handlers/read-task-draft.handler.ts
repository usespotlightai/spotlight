import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  StoredDraft,
  TaskDraftStatesPort,
} from '@work/application/ports/task-draft-states.port';
import type { ReadTaskDraftQuery } from '@work/application/queries/task-draft.queries';

export class ReadTaskDraftHandler
  implements QueryHandlerPort<ReadTaskDraftQuery, StoredDraft>
{
  constructor(private readonly states: TaskDraftStatesPort) {}

  async execute(query: ReadTaskDraftQuery): Promise<StoredDraft> {
    try {
      return await this.states.read(TaskId.of(query.taskId));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
