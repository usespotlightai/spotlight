import type { LatestChangeStackDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import type { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadTaskChangeStackHandler
  implements
    QueryHandlerPort<ReadTaskChangeStackQuery, LatestChangeStackDto | null>
{
  constructor(
    private readonly work: WorkPort,
    private readonly workspaces: WorkspacesPort,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ReadTaskChangeStackQuery,
  ): Promise<LatestChangeStackDto | null> {
    try {
      const task = await this.work.task(TaskId.of(query.taskId));

      if (
        !task ||
        !(await this.workspaces.mayView(
          UserId.of(query.viewerId),
          task.workspaceId,
        ))
      ) {
        return null;
      }

      const latest = await this.stacks.latestForTask(task.id, this.clock.now());

      return latest
        ? {
            runId: latest.runId,
            repository: latest.repository,
            state: latest.state,
            checkState: latest.check?.state ?? null,
            added: latest.added,
            removed: latest.removed,
          }
        : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
