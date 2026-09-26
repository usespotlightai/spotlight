import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { GivenAtStationsPort } from '@work/application/ports/given-at-stations.port';

export class ToolsGiven {
  constructor(
    private readonly given: GivenAtStationsPort,
    private readonly hooks: HookDefinitionRepository,
  ) {}

  async onTeam(teamId: TeamId): Promise<ToolUses> {
    const [stations, hooks] = await Promise.all([
      this.given.onTeam(teamId, 'tool'),
      this.hooks.ofTeam(teamId),
    ]);

    return ToolUses.of([
      ...stations.map((each) => ({
        tool: each.name,
        by: `the station ${each.line}/${each.station}`,
      })),
      ...hooks.flatMap((hook) =>
        hook.tools.map((tool) => ({ tool, by: `the hook ${hook.key.value}` })),
      ),
    ]);
  }
}
