import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskWorkspacesPort } from '@work/application/ports/task-workspaces.port';
import type { JoinTaskDraftQuery } from '@work/application/queries/task-draft.queries';
import type { WorkAccess } from '@work/application/services/work-access.service';

export class JoinTaskDraftHandler implements QueryHandlerPort<
  JoinTaskDraftQuery,
  boolean
> {
  constructor(
    private readonly tasks: TaskWorkspacesPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: JoinTaskDraftQuery): Promise<boolean> {
    try {
      const teamId = await this.tasks.teamOf(TaskId.of(query.taskId));

      return (
        teamId !== null &&
        (await this.access.standingOn(teamId, UserId.of(query.viewerId)))
          .actsOnTasks
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
