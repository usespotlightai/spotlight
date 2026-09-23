import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamAddress } from '@shared-kernel/domain/value-objects/team-address.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import type { LineResourcesPort } from '@work/application/ports/line-resources.port';
import type { ImportLineQuery } from '@work/application/queries/import-line.query';
import type { LineViews } from '@work/application/services/line-views.service';

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
      const viewer = UserId.of(query.viewerId);
      const workspace = await this.access.inWorkspaceWithId(
        WorkspaceId.of(query.workspaceId),
        viewer,
      );
      const team = workspace
        ? (await this.teams.inWorkspace(workspace.workspaceId)).find(
            (each) => each.key === address.teamKey,
          )
        : undefined;

      if (!team || !(await this.access.onTeam(team.id.value, viewer))) {
        return null;
      }

      const kept = await this.resources.at(team.id, address.key);

      return kept ? this.views.of(kept) : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
