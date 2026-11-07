import type {
  LineRecord,
  LineResourcesPort,
} from '@lines/application/ports/line-resources.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { renderLine } from '@lines/infrastructure/lines/line-definition.render';
import { DrizzleLineRepository } from '@lines/infrastructure/persistence/drizzle/repositories/line.repository';
import { Injectable } from '@nestjs/common';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const recordOf = (line: Line): LineRecord => ({
  id: line.id.value,
  version: line.version,
  teamId: line.teamId,
  key: line.key.value,
  definition: renderLine(line),
});

@Injectable()
export class DrizzleLineResources implements LineResourcesPort {
  constructor(private readonly lines: DrizzleLineRepository) {}

  async withId(id: string): Promise<LineRecord | null> {
    const found = await this.lines.find(LineId.of(id));

    return found ? recordOf(found) : null;
  }

  async at(teamId: TeamId, key: string): Promise<LineRecord | null> {
    const found = (await this.lines.ofTeam(teamId)).find(
      (each) => each.key.value === key,
    );

    return found ? recordOf(found) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly LineRecord[]> {
    return (await this.lines.ofTeam(teamId)).map(recordOf);
  }

  async ofTeams(teamIds: readonly TeamId[]): Promise<readonly LineRecord[]> {
    const lines = await Promise.all(
      teamIds.map((each) => this.lines.ofTeam(each)),
    );

    return lines.flat().map(recordOf);
  }
}
