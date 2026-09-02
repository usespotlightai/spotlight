import type { TeamTraceDto } from '@application/dto/team-trace.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TeamTraceMapper } from '@application/mappers/team-trace.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunDigestReaderPort } from '@application/ports/run-digest-reader.port';
import type { TeamTraceReaderPort } from '@application/ports/team-trace-reader.port';
import type { ListTeamTracesQuery } from '@application/queries/list-team-traces.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

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
