import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import { labelledRun } from '@work/application/mappers/labelled-run.mapper';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunnerTraceReaderPort } from '@work/application/ports/runner-trace-reader.port';
import type { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import type { HistoryAccesses } from '@work/application/services/history-accesses.service';
import { TraceAccess } from '@work/domain/services/trace-access';

export class ReadRunnerTraceHandler
  implements QueryHandlerPort<ReadRunnerTraceQuery, TaskTraceDto | null>
{
  constructor(
    private readonly accesses: HistoryAccesses,
    private readonly traces: RunnerTraceReaderPort,
    private readonly connections: RunConnectionsPort,
    private readonly readings: RunJournalReadingsPort,
  ) {}

  async execute(query: ReadRunnerTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const target = TaskId.of(query.taskId);

      const [leased, theirs] = await Promise.all([
        this.accesses.leasedBy(query.runId, query.runnerId),
        this.traces.teamOfTask(target),
      ]);

      leased?.access.assertReadsTraces();

      if (!leased || !TraceAccess.sameTeam(leased.team, theirs)) {
        return null;
      }

      const { access } = leased;

      if (access.hides(target)) {
        return null;
      }

      const [ran, journals] = await Promise.all([
        this.traces.runsForTask(target),
        this.traces.journalsForTask(target),
      ]);
      const found = ran.filter((run) =>
        access.seesRunAt(run.station ? StationId.of(run.station.id) : null),
      );

      if (access.isScoped && found.length === 0) {
        return null;
      }

      const errors = await this.connections.errorsIn(
        found.map((run) => run.id),
      );

      return TaskTraceMapper.toDto(
        this.readings.traceOf(found.map(labelledRun), journals, errors),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
