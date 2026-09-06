import type { TaskTraceDto } from '@application/dto/task-trace.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskTraceMapper } from '@application/mappers/task-trace.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunnerTraceReaderPort } from '@application/ports/runner-trace-reader.port';
import type { ReadRunnerTraceQuery } from '@application/queries/read-runner-trace.query';
import { traceOf, type WorkedRun } from '@application/read-models/trace-of';
import { TraceAccess } from '@domain/services/trace-access';
import { HarnessName } from '@domain/value-objects/harness-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';

export class ReadRunnerTraceHandler
  implements QueryHandlerPort<ReadRunnerTraceQuery, TaskTraceDto | null>
{
  constructor(private readonly traces: RunnerTraceReaderPort) {}

  async execute(query: ReadRunnerTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const from = await this.traces.heldTaskOf(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      if (!from) {
        return null;
      }

      const target = TaskId.of(query.taskId);

      const [mine, theirs] = await Promise.all([
        this.traces.teamOfTask(from),
        this.traces.teamOfTask(target),
      ]);

      if (!TraceAccess.sameTeam(mine, theirs)) {
        return null;
      }

      const [found, told] = await Promise.all([
        this.traces.runsForTask(target),
        this.traces.journalsForTask(target),
      ]);

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
