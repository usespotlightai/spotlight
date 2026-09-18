import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamRunDto } from '@work/application/dto/task-run.dto';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ListTeamRunsQuery } from '@work/application/queries/list-team-runs.query';

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
