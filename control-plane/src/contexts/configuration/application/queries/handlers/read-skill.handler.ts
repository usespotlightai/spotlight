import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type { SkillResourcesPort } from '@configuration/application/ports/skill-resources.port';
import type { ReadSkillQuery } from '@configuration/application/queries/read-skill.query';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const kept = await this.resources.withId(query.skillId);

      if (
        !kept ||
        !(await this.access.clearanceOnTeam(kept.teamId.value, query.principal))
      ) {
        return null;
      }

      return this.views.of(kept);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
