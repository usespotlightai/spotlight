import type { WorkspaceListingDto } from '@application/dto/workspace.dto';
import { WorkspaceMapper } from '@application/mappers/workspace.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import { UserId } from '@domain/value-objects/user-id.vo';

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
