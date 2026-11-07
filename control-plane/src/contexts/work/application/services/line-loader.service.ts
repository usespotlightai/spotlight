import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { UnknownLineError } from '@work/domain/exceptions/unknown-line.error';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export class LineLoader {
  constructor(
    private readonly access: WorkAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async onTeam(
    teamId: string,
    lineId: string,
    actorId: string,
  ): Promise<LineMap> {
    return this.actedOn(
      await this.lines.find(LineId.of(lineId)),
      teamId,
      actorId,
      () => new UnknownLineError(lineId),
    );
  }

  async atStation(
    teamId: string,
    stationId: StationId,
    actorId: string,
    unknown: () => Error,
  ): Promise<LineMap> {
    return this.actedOn(
      await this.lines.findByStation(stationId),
      teamId,
      actorId,
      unknown,
    );
  }

  private async actedOn(
    line: LineMap | null,
    teamId: string,
    actorId: string,
    unknown: () => Error,
  ): Promise<LineMap> {
    if (!line?.teamId.equals(TeamId.of(teamId))) {
      throw unknown();
    }

    (
      await this.access.standingOn(line.teamId, UserId.of(actorId))
    ).assertActsOnTasks(unknown);

    return line;
  }
}
