import type { CallbackTaskDto } from '@integrations/application/dto/callback-task.dto';
import type { TasksForHooksPort } from '@integrations/application/ports/tasks-for-hooks.port';
import type { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import type { HookCallbackGrants } from '@integrations/application/services/hook-callback-grants.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CallbackTaskHandler
  implements QueryHandlerPort<CallbackTaskQuery, CallbackTaskDto | null>
{
  constructor(
    private readonly grants: HookCallbackGrants,
    private readonly tasks: TasksForHooksPort,
  ) {}

  async execute(query: CallbackTaskQuery): Promise<CallbackTaskDto | null> {
    try {
      const grant = await this.grants.heldBy(query.token);
      const task = grant ? await this.tasks.of(grant.taskId.value, null) : null;

      if (
        !grant ||
        !task ||
        !grant.coversTaskIn(WorkspaceId.of(task.workspaceId))
      ) {
        return null;
      }

      return {
        id: task.taskId,
        title: task.title,
        url: task.url,
        line: task.line,
        station: task.station,
        stationKey: task.stationKey,
        marks: task.marks,
        repositories: task.repositories,
        pullRequest: task.pullRequest,
        hook: grant.hook,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
