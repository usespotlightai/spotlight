import {
  type InsightsTracesDto,
  insightsTracesOf,
} from '@insights/application/dto/insights-traces.dto';
import { namedOf } from '@insights/application/dto/insights.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { PeoplePort } from '@insights/application/ports/people.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import type { ListInsightsTracesQuery } from '@insights/application/queries/list-insights-traces.query';
import { runFilterInputOf } from '@insights/application/queries/run-filter-query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import { windowOf } from '@insights/application/services/team-scopes.service';
import {
  type RunFilter,
  runFilterOf,
} from '@insights/domain/services/run-filter';
import { traceVolumeOf } from '@insights/domain/services/trace-volume';
import { MAX_TRACED_RUNS, tracesOf } from '@insights/domain/services/traces';
import { unfinishedMatching } from '@insights/domain/services/unfinished-runs';
import { TraceRange } from '@insights/domain/value-objects/trace-range.vo';
import type { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ListInsightsTracesHandler implements QueryHandlerPort<
  ListInsightsTracesQuery,
  InsightsTracesDto
> {
  constructor(
    private readonly access: InsightsAccess,
    private readonly reader: InsightsReaderPort,
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListInsightsTracesQuery): Promise<InsightsTracesDto> {
    try {
      const access = await this.access.accessFor(
        TeamId.of(query.teamId),
        query.principal,
      );
      const range = TraceRange.of(query.range, this.clock.now());
      const filter = runFilterOf(runFilterInputOf(query.filter), range);
      const [unfinished, listed] = await Promise.all([
        this.work.unfinishedRuns(access.teamId),
        this.listed(access, range, filter),
      ]);
      const matching = unfinishedMatching(unfinished, filter);
      const taskIds = [
        ...new Set([...listed.runs, ...matching].map((run) => run.taskId)),
      ];
      const [ended, work] = await Promise.all([
        this.reader.runsPerTask(windowOf(access, range), taskIds),
        this.work.traced({
          taskIds,
          runIds: listed.runs.map((run) => run.runId),
          stationIds: [
            ...new Set(
              [...listed.runs, ...matching].map((run) => run.stationId),
            ),
          ],
        }),
      ]);
      const totals = new Map(ended);

      for (const run of unfinished) {
        totals.set(run.taskId, (totals.get(run.taskId) ?? 0) + 1);
      }

      const known = new Set(work.tasks.map((task) => task.taskId));
      const traces = tracesOf(listed.runs, matching, totals).filter((trace) =>
        known.has(trace.taskId),
      );
      const ids = traces.flatMap((trace) =>
        trace.runs.flatMap((run) => (run.openedBy ? [run.openedBy] : [])),
      );

      return insightsTracesOf(
        range,
        traceVolumeOf(
          traces.map((trace) => ({ at: trace.latestAt, errors: trace.errors })),
          range,
        ),
        traces,
        work,
        listed.total > listed.runs.length,
        listed.total + matching.length,
        namedOf(ids, await this.people.namesOf(ids)),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private listed(access: ViewedTeam, range: TraceRange, filter: RunFilter) {
    return this.reader.runPage({
      window: windowOf(access, range),
      filter,
      offset: 0,
      limit: MAX_TRACED_RUNS,
    });
  }
}
