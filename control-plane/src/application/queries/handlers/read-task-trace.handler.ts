import type { TaskTraceDto } from '@application/dto/task-trace.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskTraceMapper } from '@application/mappers/task-trace.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunJournalReaderPort } from '@application/ports/run-journal-reader.port';
import type { RunReaderPort } from '@application/ports/run-reader.port';
import type { ReadTaskTraceQuery } from '@application/queries/read-task-trace.query';
import { traceOf, type WorkedRun } from '@application/read-models/trace-of';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * What a task's runs came to, laid against one clock. Assembling it here and
 * not in whatever is drawing it means every reader of a trace reads the same
 * one: what a phase is, and when a span and a step are the same call, is not
 * for a client to decide.
 */
export class ReadTaskTraceHandler
  implements QueryHandlerPort<ReadTaskTraceQuery, TaskTraceDto | null>
{
  constructor(
    private readonly runs: RunReaderPort,
    private readonly journals: RunJournalReaderPort,
  ) {}

  async execute(query: ReadTaskTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const taskId = TaskId.of(query.taskId);
      const viewerId = UserId.of(query.viewerId);

      const [found, told] = await Promise.all([
        this.runs.listForTask(taskId, viewerId),
        this.journals.listForTask(taskId, viewerId),
      ]);

      if (told === null) {
        return null;
      }

      const byRun = new Map(told.map((journal) => [journal.runId, journal]));

      const worked: WorkedRun[] = found.map((run) => ({
        id: RunId.of(run.id),
        station: StationName.maybe(run.station?.name),
        harness: HarnessName.of(run.harness),
        state: run.state,
        attempt: run.attempt,
        startedAt: run.startedAt,
        endedAt: run.updatedAt,
        journal: byRun.get(run.id) ?? null,
      }));

      return TaskTraceMapper.toDto(traceOf(worked));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
