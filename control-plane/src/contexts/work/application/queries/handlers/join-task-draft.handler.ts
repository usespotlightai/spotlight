import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import type { JoinTaskDraftQuery } from '@work/application/queries/task-draft.queries';

export class JoinTaskDraftHandler
  implements QueryHandlerPort<JoinTaskDraftQuery, boolean>
{
  constructor(
    private readonly tasks: TaskWorkspacesPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async execute(query: JoinTaskDraftQuery): Promise<boolean> {
    try {
      const workspaceId = await this.tasks.workspaceOf(TaskId.of(query.taskId));

      return (
        workspaceId !== null &&
        (await this.access.mayView(UserId.of(query.viewerId), workspaceId))
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
