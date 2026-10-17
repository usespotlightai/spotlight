import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type { ListTasksQuery } from '@work/application/queries/list-tasks.query';

export class ListTasksHandler
  implements QueryHandlerPort<ListTasksQuery, TaskDto[] | null>
{
  constructor(private readonly tasks: TaskReaderPort) {}

  async execute(query: ListTasksQuery): Promise<TaskDto[] | null> {
    try {
      const found = await this.tasks.listForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return found ? found.map(TaskMapper.summaryToDto) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
