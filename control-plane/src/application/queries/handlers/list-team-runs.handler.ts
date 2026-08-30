import type { TeamRunDto } from '@application/dto/task-run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskRunMapper } from '@application/mappers/task-run.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunReaderPort } from '@application/ports/run-reader.port';
import type { ListTeamRunsQuery } from '@application/queries/list-team-runs.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListTeamRunsHandler
  implements QueryHandlerPort<ListTeamRunsQuery, TeamRunDto[]>
{
  constructor(private readonly runs: RunReaderPort) {}

  async execute(query: ListTeamRunsQuery): Promise<TeamRunDto[]> {
    try {
      const found = await this.runs.listForTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return found.map(TaskRunMapper.teamSummaryToDto);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
