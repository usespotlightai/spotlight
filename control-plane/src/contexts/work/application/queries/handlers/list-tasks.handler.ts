import { mapPage, type Page } from '@shared-kernel/application/dto/page.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type {
  ListTasksQuery,
  ReadTaskQuery,
} from '@work/application/queries/list-tasks.query';

export class ListTasksHandler
  implements QueryHandlerPort<ListTasksQuery, Page<TaskDto> | null>
{
  constructor(private readonly tasks: TaskReaderPort) {}

  async execute(query: ListTasksQuery): Promise<Page<TaskDto> | null> {
    try {
      const found = await this.tasks.listForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
        query.state === 'open'
          ? { state: 'open' }
          : { state: 'completed', lineId: query.lineId, page: query.page },
      );

      return found ? mapPage(found, TaskMapper.summaryToDto) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadTaskHandler
  implements QueryHandlerPort<ReadTaskQuery, TaskDto | null>
{
  constructor(private readonly tasks: TaskReaderPort) {}

  async execute(query: ReadTaskQuery): Promise<TaskDto | null> {
    try {
      const found = await this.tasks.findForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
        TaskId.of(query.taskId),
      );

      return found ? TaskMapper.summaryToDto(found) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
