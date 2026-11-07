import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadTaskTraceQuery } from '@work/application/queries/read-task-trace.query';
import { tracedRunsOf, traceOf } from '@work/application/read-models/trace-of';

export class ReadTaskTraceHandler
  implements QueryHandlerPort<ReadTaskTraceQuery, TaskTraceDto | null>
{
  constructor(
    private readonly runs: RunReaderPort,
    private readonly journals: RunJournalReaderPort,
    private readonly connections: RunConnectionsPort,
  ) {}

  async execute(query: ReadTaskTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const taskId = TaskId.of(query.taskId);
      const viewerId = UserId.of(query.viewerId);

      const [found, journals] = await Promise.all([
        this.runs.listForTask(taskId, viewerId),
        this.journals.listForTask(taskId, viewerId),
      ]);

      if (journals === null) {
        return null;
      }

      const errors = await this.connections.errorsIn(
        found.map((run) => run.id),
      );

      return TaskTraceMapper.toDto(
        traceOf(tracedRunsOf(found, journals, errors)),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
