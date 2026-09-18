import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamTraceDto } from '@work/application/dto/team-trace.dto';
import { TeamTraceMapper } from '@work/application/mappers/team-trace.mapper';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { TeamTraceReaderPort } from '@work/application/ports/team-trace-reader.port';
import type { ListTeamTracesQuery } from '@work/application/queries/list-team-traces.query';

export class ListTeamTracesHandler
  implements QueryHandlerPort<ListTeamTracesQuery, TeamTraceDto[]>
{
  constructor(
    private readonly traces: TeamTraceReaderPort,
    private readonly digests: RunDigestReaderPort,
  ) {}

  async execute(query: ListTeamTracesQuery): Promise<TeamTraceDto[]> {
    try {
      const found = await this.traces.listForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
        query.since,
      );

      const digests = await this.digests.forRuns(
        found.flatMap((trace) => [...trace.runIds]),
      );

      return found.map((trace) => TeamTraceMapper.toDto(trace, digests));
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
