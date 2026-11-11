import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface AdministeredWorkspace {
  readonly workspace: Workspace;
  readonly by: UserId;
}

export class WorkspaceAdministration {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async administeredBy(
    slug: string,
    principal: PersonPrincipal,
  ): Promise<AdministeredWorkspace | null> {
    const workspace = await this.workspaces.findBySlug(WorkspaceSlug.of(slug));

    return workspace?.permissionsFor(principal).isAdmin
      ? { workspace, by: principal.userId }
      : null;
  }
}
