import type { StationDto } from '@application/dto/line.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { LineMapper } from '@application/mappers/line.mapper';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { FindStationQuery } from '@application/queries/find-station.query';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class FindStationHandler
  implements QueryHandlerPort<FindStationQuery, StationDto | null>
{
  constructor(private readonly lines: LineReaderPort) {}

  async execute(query: FindStationQuery): Promise<StationDto | null> {
    try {
      const standing = await this.lines.stationFor(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
        query.lineId,
        query.stationId,
      );

      return standing ? LineMapper.summaryToDto(standing) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
