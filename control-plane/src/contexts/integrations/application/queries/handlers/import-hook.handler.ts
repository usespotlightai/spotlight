import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import type { HookResourcesPort } from '@integrations/application/ports/hook-resources.port';
import type { ImportHookQuery } from '@integrations/application/queries/import-hook.query';
import type { HookViews } from '@integrations/application/services/hook-views.service';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportHookHandler
  implements QueryHandlerPort<ImportHookQuery, HookResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: HookResourcesPort,
    private readonly views: HookViews,
  ) {}

  async execute(query: ImportHookQuery): Promise<HookResourceDto | null> {
    try {
      const address = HookAddress.parse(query.address);
      const workspace = await this.access.permissionsIn(
        WorkspaceId.of(query.workspaceId),
        query.principal,
      );
      const team = workspace
        ? (await this.teams.inWorkspace(workspace.workspaceId)).find(
            (each) => each.key === address.teamKey,
          )
        : undefined;
      const kept = team
        ? await this.resources.at(team.id, address.key.value)
        : null;

      return kept ? this.views.onTeam(kept, address.teamKey) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
