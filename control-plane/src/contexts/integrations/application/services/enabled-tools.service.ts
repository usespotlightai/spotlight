import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { EnabledAtStationsPort } from '@work/application/ports/enabled-at-stations.port';

export class EnabledTools {
  constructor(
    private readonly enabledAtStations: EnabledAtStationsPort,
    private readonly hooks: HookDefinitionRepository,
  ) {}

  async onTeam(teamId: TeamId): Promise<ToolUses> {
    const [stations, hooks] = await Promise.all([
      this.enabledAtStations.onTeam(teamId, 'tool'),
      this.hooks.ofTeam(teamId),
    ]);

    return ToolUses.of([
      ...stations.map((each) => ({
        tool: each.name,
        by: `the station ${each.line}/${each.station}`,
      })),
      ...hooks.flatMap((hook) =>
        hook.tools.map((tool) => ({
          tool: tool.value,
          by: `the hook ${hook.key.value}`,
        })),
      ),
    ]);
  }
}
