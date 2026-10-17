import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import type { ImportHarnessProfileQuery } from '@configuration/application/queries/import-harness-profile.query';
import type { HarnessProfileViews } from '@configuration/application/services/harness-profile-views.service';
import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportHarnessProfileHandler
  implements
    QueryHandlerPort<
      ImportHarnessProfileQuery,
      HarnessProfileResourceDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: HarnessProfileResourcesPort,
    private readonly views: HarnessProfileViews,
  ) {}

  async execute(
    query: ImportHarnessProfileQuery,
  ): Promise<HarnessProfileResourceDto | null> {
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

      const kept = await this.resources.at(
        team.id,
        ProfileKey.of(address.key).value,
      );

      return kept ? this.views.of(kept) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
