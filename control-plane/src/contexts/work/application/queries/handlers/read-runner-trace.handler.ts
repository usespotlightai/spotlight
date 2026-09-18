import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import type { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import {
  traceOf,
  type WorkedRun,
} from '@work/application/read-models/trace-of';
import { TraceAccess } from '@work/domain/services/trace-access';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

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
