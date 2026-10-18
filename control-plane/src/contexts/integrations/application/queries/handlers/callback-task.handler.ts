import type { CallbackTaskView } from '@integrations/application/dto/callback-task-view.dto';
import type { TasksForHooksPort } from '@integrations/application/ports/tasks-for-hooks.port';
import type { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import type { HookCallbackTokens } from '@integrations/application/services/hook-callback-tokens.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class CallbackTaskHandler
  implements QueryHandlerPort<CallbackTaskQuery, CallbackTaskView | null>
{
  constructor(
    private readonly callbackTokens: HookCallbackTokens,
    private readonly tasks: TasksForHooksPort,
  ) {}

  async execute(query: CallbackTaskQuery): Promise<CallbackTaskView | null> {
    try {
      const callbackToken = await this.callbackTokens.findByToken(query.token);
      const task = callbackToken
        ? await this.tasks.of(callbackToken.taskId.value, null)
        : null;

      if (
        !callbackToken ||
        !task ||
        !callbackToken.coversTaskIn(WorkspaceId.of(task.workspaceId))
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
        hook: callbackToken.hook,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
