import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { mapPage, type Page } from '@work/application/dto/page.dto';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type {
  ListTasksQuery,
  ReadTaskQuery,
} from '@work/application/queries/list-tasks.query';
import type { WorkAccess } from '@work/application/services/work-access.service';

export class ListTasksHandler implements QueryHandlerPort<
  ListTasksQuery,
  Page<TaskDto> | null
> {
  constructor(
    private readonly tasks: TaskReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ListTasksQuery): Promise<Page<TaskDto> | null> {
    try {
      const teamId = TeamId.of(query.teamId);

      if (!(await this.access.seesTeam(teamId, UserId.of(query.viewerId)))) {
        return null;
      }

      const found = await this.tasks.listForTeam(
        teamId,
        query.state === 'board'
          ? { state: 'board' }
          : {
              state: 'completed-station',
              lineId: query.lineId,
              page: query.page,
            },
      );

      return mapPage(found, (each) => TaskMapper.summaryToDto(each));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadTaskHandler implements QueryHandlerPort<
  ReadTaskQuery,
  TaskDto | null
> {
  constructor(
    private readonly tasks: TaskReaderPort,
    private readonly access: WorkAccess,
  ) {}

  async execute(query: ReadTaskQuery): Promise<TaskDto | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const found =
        (await this.access.seesTeam(teamId, UserId.of(query.viewerId))) &&
        (await this.tasks.findInTeam(teamId, TaskId.of(query.taskId)));

      return found ? TaskMapper.summaryToDto(found) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
