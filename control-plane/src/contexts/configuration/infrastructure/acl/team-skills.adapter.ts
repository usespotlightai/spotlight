import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';

export class TeamSkills implements TeamSkillsPort {
  constructor(
    private readonly applied: AppliedConfigurationPort,
    private readonly reader: SkillReaderPort,
    private readonly secrets: HeldSecretsPort,
  ) {}

  async readyFor(
    teamId: TeamId,
    named: readonly string[],
  ): Promise<readonly ReadySkillFolder[]> {
    if (named.length === 0) {
      return [];
    }

    const configuration = await this.applied.of(teamId);
    const held = await this.secrets.held(teamId);

    return this.reader
      .read(configuration.skills)
      .skills.filter(
        (folder) =>
          named.includes(folder.skill.key.value) &&
          folder.skill.isReadyWith(held),
      )
      .map(ReadySkillMapper.toReady);
  }
}
