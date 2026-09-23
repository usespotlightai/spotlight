import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { ReadySkillMapper } from '@configuration/infrastructure/acl/ready-skill.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import type { TeamSkillsPort } from '@work/application/ports/team-skills.port';

export class TeamSkills implements TeamSkillsPort {
  constructor(
    private readonly configurations: TeamConfigurationRepository,
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

    const applied = await this.configurations.findFor(teamId);

    if (!applied) {
      return [];
    }

    const held = await this.secrets.held(teamId);

    return this.reader
      .read(applied.files)
      .skills.filter(
        (folder) =>
          named.includes(folder.skill.key.value) &&
          folder.skill.isReadyWith(held),
      )
      .map(ReadySkillMapper.toReady);
  }
}
