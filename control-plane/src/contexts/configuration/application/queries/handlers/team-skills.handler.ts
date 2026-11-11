import type { TeamSkillsDto } from '@configuration/application/dto/skills.dto';
import type { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamSkillsHandler
  implements QueryHandlerPort<TeamSkillsQuery, TeamSkillsDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly skills: TeamSkillReading,
  ) {}

  async execute(query: TeamSkillsQuery): Promise<TeamSkillsDto | null> {
    try {
      const member = await this.access.inWorkspaceOfTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!member) {
        return null;
      }

      return {
        skills: (await this.skills.of(member.teamId)).map(({ skill }) => ({
          key: skill.key.value,
          description: skill.description,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
