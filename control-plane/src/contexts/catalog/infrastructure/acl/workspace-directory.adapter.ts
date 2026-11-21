import type {
  DirectoryPage,
  DirectoryPageRequest,
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@catalog/application/ports/workspace-directory.port';
import type {
  DirectoryWorkspace as IdentityDirectoryWorkspace,
  WorkspaceDirectoryPort as IdentityWorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const workspaceOf = (
  workspace: IdentityDirectoryWorkspace,
): DirectoryWorkspace => ({
  id: workspace.id,
  slug: workspace.slug,
  name: workspace.name,
  createdAt: workspace.createdAt,
  memberCount: workspace.memberCount,
});

export class WorkspaceDirectory implements WorkspaceDirectoryPort {
  constructor(private readonly directory: IdentityWorkspaceDirectoryPort) {}

  async list(request: DirectoryPageRequest): Promise<DirectoryPage> {
    const page = await this.directory.list({
      after: request.after,
      limit: request.limit,
      createdAfter: request.createdAfter,
    });

    return { items: page.items.map(workspaceOf), next: page.next };
  }

  async find(workspaceId: WorkspaceId): Promise<DirectoryWorkspace | null> {
    const found = await this.directory.find(workspaceId);

    return found ? workspaceOf(found) : null;
  }
}
