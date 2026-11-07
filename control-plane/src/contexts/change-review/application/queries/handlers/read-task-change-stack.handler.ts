import type { LatestChangeStackDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadTaskChangeStackHandler
  implements
    QueryHandlerPort<ReadTaskChangeStackQuery, LatestChangeStackDto | null>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ReadTaskChangeStackQuery,
  ): Promise<LatestChangeStackDto | null> {
    try {
      const access = await this.access.task(
        query.teamId,
        query.taskId,
        query.viewerId,
      );

      if (!access) {
        return null;
      }

      const latest = await this.stacks.latestForTask(
        access.task.id,
        this.clock.now(),
      );

      return latest
        ? {
            runId: latest.runId,
            repository: latest.repository,
            state: latest.state,
            checkStatus: latest.check?.status ?? null,
            added: latest.added,
            removed: latest.removed,
          }
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
