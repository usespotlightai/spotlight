import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { UnknownLineError } from '@work/domain/exceptions/unknown-line.error';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export class LineLoader {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineMapsPort,
  ) {}

  async onTeam(
    teamId: string,
    lineId: string,
    viewerId: string,
  ): Promise<LineMap> {
    const line = await this.lines.find(LineId.of(lineId));

    if (!line || !(await this.visible(line, teamId, viewerId))) {
      throw new UnknownLineError(lineId);
    }

    return line;
  }

  async findByStation(
    teamId: string,
    stationId: StationId,
    viewerId: string,
  ): Promise<LineMap | null> {
    const line = await this.lines.findByStation(stationId);

    return line && (await this.visible(line, teamId, viewerId)) ? line : null;
  }

  private async visible(
    line: LineMap,
    teamId: string,
    viewerId: string,
  ): Promise<boolean> {
    const team = await this.access.inWorkspaceOfTeam(
      TeamId.of(teamId),
      UserId.of(viewerId),
    );

    return team !== null && line.teamId.equals(team.teamId);
  }
}
