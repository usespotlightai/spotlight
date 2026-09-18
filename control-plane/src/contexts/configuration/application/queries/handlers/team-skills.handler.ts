import { skillFolder } from '@configuration/application/contracts/configuration-layout.contract';
import type { TeamSkillsDto } from '@configuration/application/dto/skills.dto';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import type { TeamConfigurationRepository } from '@configuration/domain/repositories/team-configuration.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamSkillsHandler
  implements QueryHandlerPort<TeamSkillsQuery, TeamSkillsDto | null>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: SkillReaderPort,
  ) {}

  async execute(query: TeamSkillsQuery): Promise<TeamSkillsDto | null> {
    try {
      const member = await this.teams.viewedBy(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!member) {
        return null;
      }

      const applied = await this.configurations.findFor(member.teamId);
      const { skills } = this.reader.read(applied?.files ?? []);

      return {
        repository: applied?.repository.value ?? null,
        skills: skills.map(({ skill }) => ({
          key: skill.key.value,
          description: skill.description,
          path: skillFolder(skill.key.value),
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
