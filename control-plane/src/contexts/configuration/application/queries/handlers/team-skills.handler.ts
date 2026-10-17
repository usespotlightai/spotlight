import type { TeamSkillsDto } from '@configuration/application/dto/skills.dto';
import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { SkillReaderPort } from '@configuration/application/ports/skill-reader.port';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamSkillsHandler
  implements QueryHandlerPort<TeamSkillsQuery, TeamSkillsDto | null>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly applied: AppliedConfigurationPort,
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

      const applied = await this.applied.of(member.teamId);
      const { skills } = this.reader.read(applied.skills);

      return {
        skills: skills.map(({ skill }) => ({
          key: skill.key.value,
          description: skill.description,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
