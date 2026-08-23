import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { AssemblyLineReaderPort } from '@application/ports/assembly-line-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class ListAssemblyLinesHandler
  implements QueryHandlerPort<ListAssemblyLinesQuery, AssemblyLineDto[] | null>
{
  constructor(private readonly lines: AssemblyLineReaderPort) {}

  async execute(
    query: ListAssemblyLinesQuery,
  ): Promise<AssemblyLineDto[] | null> {
    try {
      const found = await this.lines.listForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return found ? found.map(AssemblyLineMapper.detailToDto) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
