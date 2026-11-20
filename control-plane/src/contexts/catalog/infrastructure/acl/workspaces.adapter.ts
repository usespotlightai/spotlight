import type {
  WorkspaceListing,
  WorkspaceListingPage,
  WorkspaceListingRequest,
  WorkspacesPort,
} from '@catalog/application/ports/workspaces.port';
import type {
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const listingOf = (workspace: DirectoryWorkspace): WorkspaceListing => ({
  id: WorkspaceId.of(workspace.id),
  slug: workspace.slug,
  name: workspace.name,
  createdAt: workspace.createdAt,
  memberCount: workspace.memberCount,
});

export class Workspaces implements WorkspacesPort {
  constructor(private readonly directory: WorkspaceDirectoryPort) {}

  async list(request: WorkspaceListingRequest): Promise<WorkspaceListingPage> {
    const page = await this.directory.list(request);

    return { items: page.items.map(listingOf), next: page.next };
  }

  async find(workspaceId: WorkspaceId): Promise<WorkspaceListing | null> {
    const found = await this.directory.find(workspaceId);

    return found ? listingOf(found) : null;
  }
}
