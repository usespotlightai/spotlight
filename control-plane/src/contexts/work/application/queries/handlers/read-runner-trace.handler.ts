import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type {
  LeasedRunFacts,
  RunnerTraceReaderPort,
} from '@work/application/ports/runner-trace-reader.port';
import type { SearchSightPort } from '@work/application/ports/search-sight.port';
import type { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { SightedHistory } from '@work/application/read-models/sighted-history';
import {
  connectionsOf,
  traceOf,
  type WorkedRun,
} from '@work/application/read-models/trace-of';
import { NotAllowedInReplayError } from '@work/domain/exceptions/not-allowed-in-replay.error';
import { TraceAccess } from '@work/domain/services/trace-access';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

export class ReadRunnerTraceHandler
  implements QueryHandlerPort<ReadRunnerTraceQuery, TaskTraceDto | null>
{
  constructor(
    private readonly traces: RunnerTraceReaderPort,
    private readonly sights: SearchSightPort,
    private readonly connections: RunConnectionsPort,
  ) {}

  async execute(query: ReadRunnerTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const target = TaskId.of(query.taskId);

      const [leased, theirs] = await Promise.all([
        this.traces.leasedRunFacts(
          RunId.of(query.runId),
          RunnerId.of(query.runnerId),
        ),
        this.traces.teamOfTask(target),
      ]);

      if (leased?.replaysFrom) {
        throw new NotAllowedInReplayError('read a task’s trace');
      }

      if (!TraceAccess.sameTeam(leased?.teamId ?? null, theirs)) {
        return null;
      }

      const sighted = await this.sightedBy(query.runId, leased);

      if (sighted.hides(query)) {
        return null;
      }

      const [ran, journals] = await Promise.all([
        this.traces.runsForTask(target),
        this.traces.journalsForTask(target),
      ]);
      const found = ran.filter((run) =>
        sighted.seesRunAt(run.station?.id ?? null),
      );

      if (sighted.isSearch && found.length === 0) {
        return null;
      }

      const byRun = new Map(
        journals.map((journal) => [journal.runId, journal]),
      );
      const errors = await this.connections.errorsIn(
        found.map((run) => run.id),
      );

      const worked: WorkedRun[] = found.map((run) => ({
        id: RunId.of(run.id),
        station: StationName.maybe(run.station?.name),
        harness: HarnessName.of(run.harness),
        state: run.state,
        attempt: run.attempt,
        startedAt: run.startedAt,
        endedAt: run.updatedAt,
        journal: byRun.get(run.id) ?? null,
        connections: connectionsOf(errors, run.id, run.attempt),
      }));

      return TaskTraceMapper.toDto(traceOf(worked));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async sightedBy(
    runId: string,
    leased: LeasedRunFacts | null,
  ): Promise<SightedHistory> {
    return leased?.isSearch
      ? SightedHistory.through(await this.sights.of(runId))
      : SightedHistory.unsighted();
  }
}
