import type { PublicChangeStacksDto } from '@change-review/application/dto/change-stack.dto';
import type { ListPublicTaskChangeStacksQuery } from '@change-review/application/queries/list-public-task-change-stacks.query';
import type { PublicWorkAccess } from '@change-review/application/services/public-work-access.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ListPublicTaskChangeStacksHandler implements QueryHandlerPort<
  ListPublicTaskChangeStacksQuery,
  PublicChangeStacksDto | null
> {
  constructor(private readonly access: PublicWorkAccess) {}

  async execute(
    query: ListPublicTaskChangeStacksQuery,
  ): Promise<PublicChangeStacksDto | null> {
    try {
      const stacks = await this.access.stacksOf({
        kind: 'task',
        taskId: TaskId.of(query.taskId),
      });

      return stacks && { stacks };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
