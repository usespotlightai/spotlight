import type { SecretNamesPort } from '@configuration/application/ports/secret-names.port';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import type { TeamSkillFilesPort } from '@configuration/application/ports/team-skill-files.port';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';

export class TeamSkills implements TeamSkillsPort {
  constructor(
    private readonly teamSkillFiles: TeamSkillFilesPort,
    private readonly reader: SkillReaderPort,
    private readonly secrets: SecretNamesPort,
  ) {}

  async definedFor(teamId: TeamId): Promise<readonly string[]> {
    const configuration = await this.teamSkillFiles.of(teamId);

    return this.reader
      .parse(configuration.skills)
      .skills.map((folder) => folder.skill.key.value);
  }

  async readyFor(
    teamId: TeamId,
    named: readonly string[],
  ): Promise<readonly ReadySkillFolder[]> {
    if (named.length === 0) {
      return [];
    }

    const configuration = await this.teamSkillFiles.of(teamId);
    const existing = await this.secrets.ofTeam(teamId);

    return this.reader
      .parse(configuration.skills)
      .skills.filter(
        (folder) =>
          named.includes(folder.skill.key.value) &&
          folder.skill.isReadyWith(existing),
      )
      .map(ReadySkillMapper.toReady);
  }
}
