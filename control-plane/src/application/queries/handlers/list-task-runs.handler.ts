import type { TaskRunDto } from '@application/dto/task-run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskRunMapper } from '@application/mappers/task-run.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunReaderPort } from '@application/ports/run-reader.port';
import type { ListTaskRunsQuery } from '@application/queries/list-task-runs.query';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListTaskRunsHandler
  implements QueryHandlerPort<ListTaskRunsQuery, TaskRunDto[]>
{
  constructor(private readonly runs: RunReaderPort) {}

  async execute(query: ListTaskRunsQuery): Promise<TaskRunDto[]> {
    try {
      const found = await this.runs.listForTask(
        TaskId.of(query.taskId),
        UserId.of(query.viewerId),
      );

      return found.map(TaskRunMapper.summaryToDto);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
