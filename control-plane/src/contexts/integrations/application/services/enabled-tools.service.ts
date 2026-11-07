import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import type { EnabledAtStationsPort } from '@lines/application/ports/enabled-at-stations.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

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
      ...stations.flatMap((each) => {
        const tool = ToolName.parsed(each.name);

        return tool
          ? [{ tool, by: `the station ${each.line}/${each.station}` }]
          : [];
      }),
      ...hooks.flatMap((hook) =>
        hook.tools.map((tool) => ({ tool, by: `the hook ${hook.key.value}` })),
      ),
    ]);
  }
}
