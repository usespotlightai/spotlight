import type { CallbackTaskDto } from '@integrations/application/dto/callback-task.dto';
import type { HookCallbacksPort } from '@integrations/application/ports/hook-callbacks.port';
import type { CallbackTaskQuery } from '@integrations/application/queries/callback-task.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { HookedTasksPort } from '@work/application/ports/hooked-tasks.port';

export class CallbackTaskHandler
  implements QueryHandlerPort<CallbackTaskQuery, CallbackTaskDto | null>
{
  constructor(
    private readonly callbacks: HookCallbacksPort,
    private readonly tasks: HookedTasksPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: CallbackTaskQuery): Promise<CallbackTaskDto | null> {
    try {
      const holder = await this.callbacks.heldBy(query.token, this.clock.now());
      const task = holder ? await this.tasks.of(holder.taskId, null) : null;

      if (!holder || !task || task.workspaceId !== holder.workspaceId) {
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
        hook: holder.hook,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
