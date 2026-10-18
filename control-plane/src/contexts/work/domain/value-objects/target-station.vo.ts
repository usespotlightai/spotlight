import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import type { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';
import type { LineName } from '@work/domain/value-objects/line-name.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';

export class TargetStation {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: LineId,
    readonly lineKey: LineKey,
    readonly lineName: LineName,
    readonly stationId: StationId,
    readonly stationKey: StationKey,
    readonly stationName: StationName,
  ) {}

  static at(line: Line, station: Station): TargetStation {
    if (!station.isAgentStation || !line.stationAt(station.id)) {
      throw new InvalidChatMessageError(
        'can only improve a station that runs an agent',
      );
    }

    return TargetStation.rehydrate({
      teamId: line.teamId,
      lineId: line.id,
      lineKey: line.key,
      lineName: line.name,
      stationId: station.id,
      stationKey: station.key,
      stationName: station.name,
    });
  }

  static rehydrate(input: {
    teamId: TeamId;
    lineId: LineId;
    lineKey: LineKey;
    lineName: LineName;
    stationId: StationId;
    stationKey: StationKey;
    stationName: StationName;
  }): TargetStation {
    return new TargetStation(
      input.teamId,
      input.lineId,
      input.lineKey,
      input.lineName,
      input.stationId,
      input.stationKey,
      input.stationName,
    );
  }

  equals(other: TargetStation): boolean {
    return this.stationId.equals(other.stationId);
  }
}
