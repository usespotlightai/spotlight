import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { ReadSkillQuery } from '@configuration/application/queries/read-skill.query';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadSkillHandler
  implements QueryHandlerPort<ReadSkillQuery, SkillResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly resources: SkillResourcesPort,
    private readonly views: SkillViews,
  ) {}

  async execute(query: ReadSkillQuery): Promise<SkillResourceDto | null> {
    try {
      const record = await this.resources.withId(
        SkillDefinitionId.of(query.skillId),
      );

      if (
        !record ||
        !(await this.access.permissionsInWorkspaceOfTeam(
          record.teamId,
          query.principal,
        ))
      ) {
        return null;
      }

      return this.views.of(record);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
