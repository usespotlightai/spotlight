import { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { GivenSkillsPort } from '@work/application/ports/given-skills.port';

export class SkillsGiven {
  constructor(private readonly given: GivenSkillsPort) {}

  async onTeam(teamId: TeamId): Promise<SkillUses> {
    return SkillUses.of(
      (await this.given.onTeam(teamId)).map((each) => ({
        skill: each.skill,
        by: `${each.line}/${each.station}`,
      })),
    );
  }
}
