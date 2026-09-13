import type { LineDto } from '@application/dto/line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { LineMapper } from '@application/mappers/line.mapper';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListLinesQuery } from '@application/queries/list-lines.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

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
      rethrowAsFault(error);
    }
  }
}
