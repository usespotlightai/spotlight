import type { LabelDto } from '@application/dto/label.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { LabelMapper } from '@application/mappers/label.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListLabelsQuery } from '@application/queries/list-labels.query';
import type { LabelRepository } from '@domain/repositories/label.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListLabelsHandler
  implements QueryHandlerPort<ListLabelsQuery, LabelDto[] | null>
{
  constructor(
    private readonly labels: LabelRepository,
    private readonly teams: TeamRepository,
  ) {}

  async execute(query: ListLabelsQuery): Promise<LabelDto[] | null> {
    try {
      const team = await this.teams.find(TeamId.of(query.teamId));

      if (!team?.holds(UserId.of(query.viewerId))) {
        return null;
      }

      const found = await this.labels.forTeam(TeamId.of(query.teamId));

      return found.map(LabelMapper.toDto);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
