import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { WatchedWorkspacesQuery } from '@notifications/application/queries/watched-workspaces.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WatchedWorkspacesHandler
  implements QueryHandlerPort<WatchedWorkspacesQuery, readonly string[]>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async execute(query: WatchedWorkspacesQuery): Promise<readonly string[]> {
    const person = UserId.of(query.personId);
    const listed = await this.workspaces.listForMember(person);
    const viewable = await Promise.all(
      listed.map(async (each) =>
        (await this.access.mayView(person, WorkspaceId.of(each.id)))
          ? [each.id]
          : [],
      ),
    );

    return viewable.flat();
  }
}
