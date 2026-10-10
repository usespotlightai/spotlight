import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface AdministeredWorkspace {
  readonly workspace: Workspace;
  readonly by: UserId;
}

export class WorkspaceAdministration {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async administeredBy(
    slug: string,
    viewerId: string,
  ): Promise<AdministeredWorkspace | null> {
    const by = UserId.of(viewerId);
    const workspace = await this.workspaces.findBySlug(WorkspaceSlug.of(slug));

    return workspace?.administeredBy(by) ? { workspace, by } : null;
  }
}
