import type { StationDto } from '@application/dto/assembly-line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { AssemblyLineMapper } from '@application/mappers/assembly-line.mapper';
import type { AssemblyLineReaderPort } from '@application/ports/assembly-line-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { FindStationQuery } from '@application/queries/find-station.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

/**
 * A station the caller can see, or nothing. Whether a line is theirs to look
 * at is the reader's to answer, so no caller has to work it out again.
 */
export class FindStationHandler
  implements QueryHandlerPort<FindStationQuery, StationDto | null>
{
  constructor(private readonly lines: AssemblyLineReaderPort) {}

  async execute(query: FindStationQuery): Promise<StationDto | null> {
    try {
      const visible = await this.lines.listForTeamMember(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      const standing = visible
        ?.find((line) => line.id === query.lineId)
        ?.stations.find((station) => station.id === query.stationId);

      return standing ? AssemblyLineMapper.summaryToDto(standing) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
