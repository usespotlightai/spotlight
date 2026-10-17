import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { UnknownLineError } from '@work/domain/exceptions/unknown-line.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class LineLoader {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineRepository,
  ) {}

  async onTeam(
    teamId: string,
    lineId: string,
    viewerId: string,
  ): Promise<Line> {
    const line = await this.lines.find(LineId.of(lineId));

    if (!line || !(await this.visible(line, teamId, viewerId))) {
      throw new UnknownLineError(lineId);
    }

    return line;
  }

  async holding(
    teamId: string,
    stationId: StationId,
    viewerId: string,
  ): Promise<Line | null> {
    const line = await this.lines.holding(stationId);

    return line && (await this.visible(line, teamId, viewerId)) ? line : null;
  }

  private async visible(
    line: Line,
    teamId: string,
    viewerId: string,
  ): Promise<boolean> {
    const team = await this.access.onTeam(teamId, UserId.of(viewerId));

    return team !== null && line.teamId.equals(team.teamId);
  }
}
