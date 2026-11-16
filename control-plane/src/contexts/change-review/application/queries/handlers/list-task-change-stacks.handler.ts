import type { ChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { ListTaskChangeStacksQuery } from '@change-review/application/queries/list-task-change-stacks.query';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListTaskChangeStacksHandler implements QueryHandlerPort<
  ListTaskChangeStacksQuery,
  ChangeStacksDto | null
> {
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ListTaskChangeStacksQuery,
  ): Promise<ChangeStacksDto | null> {
    try {
      const access = await this.access.task(
        query.teamId,
        query.taskId,
        query.viewerId,
      );

      return access
        ? {
            stacks: await this.stacks.ofTask(
              access.task.id,
              UserId.of(query.viewerId),
              this.clock.now(),
            ),
          }
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
