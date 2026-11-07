import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

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

  static at(line: LineMap, station: Station): TargetStation {
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

  isOnly(named: { line: string | null; station: string | null }): boolean {
    return (
      (named.line === null || named.line === this.lineKey.value) &&
      (named.station === null || named.station === this.stationKey.value)
    );
  }

  equals(other: TargetStation): boolean {
    return this.stationId.equals(other.stationId);
  }
}
