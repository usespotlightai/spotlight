import type { HookConfigsPort } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import type {
  ConfiguredSkill,
  HookAtStation,
  HookStation,
  PlannedHookMatch,
  PlannedIntegration,
  TeamConfigurationPort,
} from '@configuration/application/ports/team-configuration.port';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamConfiguration implements TeamConfigurationPort {
  constructor(
    private readonly teamSkills: TeamSkillReading,
    private readonly teamHooks: HookConfigsPort,
    private readonly integrations: IntegrationConfigsPort,
  ) {}

  async enablingToolsOnMarks(
    planned: readonly PlannedIntegration[],
  ): Promise<readonly string[]> {
    const enabling = await Promise.all(
      planned.map(async ({ key, definition }) => {
        const tools = definition
          ? await this.integrations.toolsOnAnyMarkAsPlanned(definition)
          : [];

        return tools === null || tools.length > 0 ? [key] : [];
      }),
    );

    return enabling.flat();
  }

  async skills(teamId: TeamId): Promise<readonly ConfiguredSkill[]> {
    return (await this.teamSkills.of(teamId)).map(({ skill }) => ({
      key: skill.key.skill.value,
      secrets: skill.secrets.map((each) => each.name.value),
    }));
  }

  hooksAt(
    teamId: TeamId,
    station: HookStation,
    planned: readonly PlannedHookMatch[],
  ): Promise<readonly HookAtStation[]> {
    return this.teamHooks.mayFireAt(teamId, station, planned);
  }
}
