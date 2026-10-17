import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { ImportSkillQuery } from '@configuration/application/queries/import-skill.query';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportSkillHandler
  implements QueryHandlerPort<ImportSkillQuery, SkillResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: SkillResourcesPort,
    private readonly views: SkillViews,
  ) {}

  async execute(query: ImportSkillQuery): Promise<SkillResourceDto | null> {
    try {
      const address = TeamAddress.parse(query.address);
      const workspace = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const team = workspace
        ? (await this.teams.inWorkspace(workspace.workspaceId)).find(
            (each) => each.key === address.teamKey,
          )
        : undefined;

      if (!team) {
        return null;
      }

      const record = await this.resources.at(
        team.id,
        SkillKey.of(address.key).value,
      );

      return record ? this.views.of(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
