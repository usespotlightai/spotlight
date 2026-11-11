import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskRunDto } from '@work/application/dto/task-run.dto';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ListTaskRunsQuery } from '@work/application/queries/list-task-runs.query';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ListTaskRunsHandler implements QueryHandlerPort<
  ListTaskRunsQuery,
  TaskRunDto[]
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ListTaskRunsQuery): Promise<TaskRunDto[]> {
    try {
      const found = await this.access.shownInWorkspace(
        await this.runs.listForTask(TaskId.of(query.taskId)),
        UserId.of(query.viewerId),
      );

      return (found ?? []).map((each) => TaskRunMapper.summaryToDto(each));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
