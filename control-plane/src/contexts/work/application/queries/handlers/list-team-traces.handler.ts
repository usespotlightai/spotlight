import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamTracesDto } from '@work/application/dto/team-trace.dto';
import { TeamTraceMapper } from '@work/application/mappers/team-trace.mapper';
import type { RunUsageReaderPort } from '@work/application/ports/run-usage-reader.port';
import type { TeamTraceReaderPort } from '@work/application/ports/team-trace-reader.port';
import type { ListTeamTracesQuery } from '@work/application/queries/list-team-traces.query';
import { traceVolumeOf } from '@work/domain/services/trace-volume';
import { TraceRange } from '@work/domain/value-objects/trace-range.vo';

export class ListTeamTracesHandler
  implements QueryHandlerPort<ListTeamTracesQuery, TeamTracesDto>
{
  constructor(
    private readonly traces: TeamTraceReaderPort,
    private readonly usages: RunUsageReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ListTeamTracesQuery): Promise<TeamTracesDto> {
    try {
      const range = TraceRange.of(query.range, this.clock.now());

      const found = await this.traces.listForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
        range.from,
      );

      const usages = await this.usages.forRuns(
        found.flatMap((trace) => [...trace.runIds]),
      );

      const traces = found.map((trace) => TeamTraceMapper.toDto(trace, usages));

      const volume = traceVolumeOf(
        found.map((trace) => ({
          startedAt: trace.startedAt,
          errors: trace.runIds.reduce(
            (sum, runId) => sum + (usages.get(runId.value)?.errors ?? 0),
            0,
          ),
        })),
        range,
      );

      return TeamTraceMapper.toTracesDto(range, volume, traces);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
