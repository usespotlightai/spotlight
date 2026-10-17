import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';

export class StationSkills {
  constructor(private readonly skills: TeamSkillsPort) {}

  async readyAt(
    line: Line,
    station: Station,
  ): Promise<readonly ReadySkillFolder[]> {
    const teamSkills = station.skills.filter((each) => !each.catalogued);

    return teamSkills.length === 0
      ? []
      : this.skills.readyFor(
          line.teamId,
          teamSkills.map((each) => each.value),
        );
  }
}
