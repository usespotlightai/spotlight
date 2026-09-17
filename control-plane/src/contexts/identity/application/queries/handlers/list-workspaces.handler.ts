import type { WorkspaceListingDto } from '@identity/application/dto/workspace.dto';
import { WorkspaceMapper } from '@identity/application/mappers/workspace.mapper';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ListWorkspacesQuery } from '@identity/application/queries/list-workspaces.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListWorkspacesHandler
  implements QueryHandlerPort<ListWorkspacesQuery, WorkspaceListingDto[]>
{
  constructor(private readonly workspaces: WorkspaceReaderPort) {}

  async execute(query: ListWorkspacesQuery): Promise<WorkspaceListingDto[]> {
    const listings = await this.workspaces.listForMember(
      UserId.of(query.userId),
    );
    return listings.map(WorkspaceMapper.listingToDto);
  }
}
