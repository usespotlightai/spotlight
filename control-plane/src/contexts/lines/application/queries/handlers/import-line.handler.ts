import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { LineResourceDto } from '@lines/application/dto/line-resource.dto';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { ImportLineQuery } from '@lines/application/queries/import-line.query';
import type { LineViews } from '@lines/application/services/line-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ImportLineHandler
  implements QueryHandlerPort<ImportLineQuery, LineResourceDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly teams: TeamDirectoryPort,
    private readonly resources: LineResourcesPort,
    private readonly views: LineViews,
  ) {}

  async execute(query: ImportLineQuery): Promise<LineResourceDto | null> {
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

      const record = await this.resources.at(team.id, LineKey.of(address.key));

      return record ? this.views.of(record) : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
