import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskTraceDto } from '@work/application/dto/task-trace.dto';
import { TaskTraceMapper } from '@work/application/mappers/task-trace.mapper';
import type {
  HeldRunStanding,
  RunnerTraceReaderPort,
} from '@work/application/ports/runner-trace-reader.port';
import type { SearchSightPort } from '@work/application/ports/search-sight.port';
import type { ReadRunnerTraceQuery } from '@work/application/queries/read-runner-trace.query';
import { SightedHistory } from '@work/application/read-models/sighted-history';
import {
  traceOf,
  type WorkedRun,
} from '@work/application/read-models/trace-of';
import { KeptFromReplaysError } from '@work/domain/exceptions/kept-from-replays.error';
import { TraceAccess } from '@work/domain/services/trace-access';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';

export class ReadRunnerTraceHandler
  implements QueryHandlerPort<ReadRunnerTraceQuery, TaskTraceDto | null>
{
  constructor(
    private readonly traces: RunnerTraceReaderPort,
    private readonly sights: SearchSightPort,
  ) {}

  async execute(query: ReadRunnerTraceQuery): Promise<TaskTraceDto | null> {
    try {
      const target = TaskId.of(query.taskId);

      const [held, theirs] = await Promise.all([
        this.traces.heldRunStanding(
          RunId.of(query.runId),
          RunnerId.of(query.runnerId),
        ),
        this.traces.teamOfTask(target),
      ]);

      if (held?.replaysFrom) {
        throw new KeptFromReplaysError('read a task’s trace');
      }

      if (!TraceAccess.sameTeam(held?.teamId ?? null, theirs)) {
        return null;
      }

      const sighted = await this.sightedBy(query.runId, held);

      if (sighted.hides(query)) {
        return null;
      }

      const [ran, told] = await Promise.all([
        this.traces.runsForTask(target),
        this.traces.journalsForTask(target),
      ]);
      const found = ran.filter((run) =>
        sighted.seesRunAt(run.station?.id ?? null),
      );

      if (sighted.isSearch && found.length === 0) {
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

  private async sightedBy(
    runId: string,
    held: HeldRunStanding | null,
  ): Promise<SightedHistory> {
    return held?.isSearch
      ? SightedHistory.through(await this.sights.of(runId))
      : SightedHistory.unsighted();
  }
}
