import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { TaskReaderPort } from '@application/ports/task-reader.port';
import type { ListTasksQuery } from '@application/queries/list-tasks.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

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
      rethrowAsFault(error);
    }
  }
}
