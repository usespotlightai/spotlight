import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import type { SkillToolsPort } from '@lines/application/ports/skill-tools.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class StationSkillTools implements SkillToolsPort {
  constructor(
    private readonly resources: SkillResourcesPort,
    private readonly views: SkillViews,
    private readonly logger: LoggerPort,
  ) {}

  async ofTeam(
    teamId: TeamId,
    skills: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const wanted = new Set(skills);
    const tools = new Map<string, readonly string[]>();

    for (const record of await this.resources.ofTeam(teamId)) {
      if (!wanted.has(record.key)) {
        continue;
      }

      const view = this.views.onTeam(record, record.key);

      if (view.warnings.length > 0) {
        this.logger.warn(
          { teamId: teamId.value, skill: record.key },
          `Skill ${record.key} skipped from station tools: ${view.warnings.map((each) => each.reason).join('; ')}`,
        );
        continue;
      }

      tools.set(record.key, view.tools);
    }

    return tools;
  }
}
