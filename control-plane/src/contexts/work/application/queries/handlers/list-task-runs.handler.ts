import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskRunDto } from '@work/application/dto/task-run.dto';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import { messageReadingOn } from '@work/application/services/message-reading';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ListTaskRunsHandler implements QueryHandlerPort<
  ListTaskRunsQuery,
  TaskRunDto[]
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ListTaskRunsQuery): Promise<TaskRunDto[]> {
    try {
      const person = UserId.of(query.viewerId);
      const found =
        (await this.access.shownInWorkspace(
          await this.runs.listForTask(TaskId.of(query.taskId)),
          person,
        )) ?? [];
      const first = firstOf(found);

      if (first === undefined) {
        return [];
      }

      const reading = await messageReadingOn(
        this.access.viewerOn(first.audience.teamId, person),
        this.lines,
        first.audience.teamId,
      );

      return found.map((each) => TaskRunMapper.summaryToDto(each, reading));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
