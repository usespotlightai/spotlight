import type { TeamSkillsDto } from '@application/dto/skills.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { SkillReaderPort } from '@application/ports/skill-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { TeamSkillsQuery } from '@application/queries/team-skills.query';
import { skillFolder } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class TeamSkillsHandler
  implements QueryHandlerPort<TeamSkillsQuery, TeamSkillsDto | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: SkillReaderPort,
  ) {}

  async execute(query: TeamSkillsQuery): Promise<TeamSkillsDto | null> {
    try {
      const member = await this.workspaces.findTeamForMember(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!member) {
        return null;
      }

      const applied = await this.configurations.findFor(
        TeamId.of(member.teamId),
      );
      const { skills } = this.reader.read(applied?.files ?? []);

      return {
        repository: applied?.repository.value ?? null,
        skills: skills.map(({ skill }) => ({
          key: skill.key.value,
          description: skill.description,
          path: skillFolder(skill.key),
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
