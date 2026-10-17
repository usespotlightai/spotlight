import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineDto } from '@work/application/dto/line.dto';
import { LineMapper } from '@work/application/mappers/line.mapper';
import type { LineReaderPort } from '@work/application/ports/line-reader.port';
import type { ListLinesQuery } from '@work/application/queries/list-lines.query';

export class ListLinesHandler
  implements QueryHandlerPort<ListLinesQuery, LineDto[] | null>
{
  constructor(private readonly lines: LineReaderPort) {}

  async execute(query: ListLinesQuery): Promise<LineDto[] | null> {
    try {
      const found = await this.lines.listForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return found ? found.map(LineMapper.detailToDto) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
