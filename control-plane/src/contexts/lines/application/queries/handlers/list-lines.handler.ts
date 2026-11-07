import type { LineDto } from '@lines/application/dto/line.dto';
import { LineMapper } from '@lines/application/mappers/line.mapper';
import type { LineReaderPort } from '@lines/application/ports/line-reader.port';
import type { ListLinesQuery } from '@lines/application/queries/list-lines.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

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
