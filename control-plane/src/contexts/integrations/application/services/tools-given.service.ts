import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { GivenToolsPort } from '@work/application/ports/given-tools.port';

export class ToolsGiven {
  constructor(private readonly given: GivenToolsPort) {}

  async onTeam(teamId: TeamId): Promise<ToolUses> {
    return ToolUses.of(
      (await this.given.onTeam(teamId)).map((each) => ({
        tool: each.tool,
        by: `${each.line}/${each.station}`,
      })),
    );
  }
}
