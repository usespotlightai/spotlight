import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { GivenAtStationsPort } from '@work/application/ports/given-at-stations.port';

export class ToolsGiven {
  constructor(private readonly given: GivenAtStationsPort) {}

  async onTeam(teamId: TeamId): Promise<ToolUses> {
    return ToolUses.of(
      (await this.given.onTeam(teamId, 'tool')).map((each) => ({
        tool: each.name,
        by: `${each.line}/${each.station}`,
      })),
    );
  }
}
