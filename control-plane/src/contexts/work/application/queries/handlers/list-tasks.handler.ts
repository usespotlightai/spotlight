import { mapPage, type Page } from '@shared-kernel/application/dto/page.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import type {
  ListTasksQuery,
  ReadTaskQuery,
} from '@work/application/queries/list-tasks.query';
import { messageReadingOf } from '@work/application/services/message-reading';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { TaskSearch } from '@work/domain/value-objects/task-search.vo';

export class ListTasksHandler implements QueryHandlerPort<
  ListTasksQuery,
  Page<TaskDto> | null
> {
  constructor(
    private readonly tasks: TaskReaderPort,
    private readonly access: WorkAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ListTasksQuery): Promise<Page<TaskDto> | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const viewer = UserId.of(query.viewerId);

      const [standing, lines] = await Promise.all([
        this.access.standingOn(teamId, viewer),
        this.lines.ofTeam(teamId),
      ]);

      if (!standing.seesTasks) {
        return null;
      }

      const search = query.search === null ? null : TaskSearch.of(query.search);
      const found = await this.tasks.listForTeam(
        teamId,
        query.state === 'board'
          ? { state: 'board', search }
          : {
              state: 'completed-station',
              lineId: query.lineId,
              search,
              page: query.page,
            },
      );

      const reading = messageReadingOf(
        { person: viewer, team: standing },
        lines,
      );

      return mapPage(found, (each) => TaskMapper.summaryToDto(each, reading));
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
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ReadTaskQuery): Promise<TaskDto | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const viewer = UserId.of(query.viewerId);
      const [standing, found, lines] = await Promise.all([
        this.access.standingOn(teamId, viewer),
        this.tasks.findInTeam(teamId, TaskId.of(query.taskId)),
        this.lines.ofTeam(teamId),
      ]);

      return standing.seesTasks && found
        ? TaskMapper.summaryToDto(
            found,
            messageReadingOf({ person: viewer, team: standing }, lines),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
