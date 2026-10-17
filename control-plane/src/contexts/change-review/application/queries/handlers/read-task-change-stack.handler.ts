import type { LatestChangeStackDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import type { ChangeStackAccess } from '@change-review/application/services/change-stack-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadTaskChangeStackHandler
  implements
    QueryHandlerPort<ReadTaskChangeStackQuery, LatestChangeStackDto | null>
{
  constructor(
    private readonly access: ChangeStackAccess,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ReadTaskChangeStackQuery,
  ): Promise<LatestChangeStackDto | null> {
    try {
      const task = await this.access.ofTask(
        query.teamId,
        query.taskId,
        query.viewerId,
      );

      if (!task) {
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
      rethrowAsApplicationError(error);
    }
  }
}
