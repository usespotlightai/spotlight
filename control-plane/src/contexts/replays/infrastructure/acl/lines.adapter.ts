import type { LinesPort as PublishedLinesPort } from '@lines/application/ports/lines.port';
import type {
  LinesPort,
  NamedStation,
  SearchedStation,
} from '@replays/application/ports/lines.port';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const AGENT_STATION = 'work';

export class Lines implements LinesPort {
  constructor(private readonly lines: PublishedLinesPort) {}

  async namedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<NamedStation | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    return line && station
      ? {
          lineKey: line.key,
          lineName: line.name,
          key: station.key,
          name: station.name,
        }
      : null;
  }

  async searchedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<SearchedStation | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    if (!line || !station) {
      return null;
    }

    const placement = RunnerPlacement.of(station.runners)
      .or(RunnerPlacement.of(line.runners))
      .in(line.image ? RunnerImage.of(line.image) : null);

    return {
      workspaceId: WorkspaceId.of(line.workspaceId),
      teamId: TeamId.of(line.teamId),
      runsAnAgent: station.kind === AGENT_STATION,
      placement: {
        labelGroups: placement.labelGroups,
        image: placement.image?.value ?? null,
      },
    };
  }
}
