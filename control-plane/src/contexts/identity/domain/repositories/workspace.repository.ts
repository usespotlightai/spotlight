import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceSlugRegistry {
  isTaken(slug: WorkspaceSlug): Promise<boolean>;
}

interface WorkspaceFinding {
  find(workspaceId: WorkspaceId): Promise<Workspace | null>;
}

export interface WorkspaceRepository
  extends WorkspaceSlugRegistry,
    WorkspaceFinding {
  add(workspace: Workspace): Promise<void>;

  save(workspace: Workspace): Promise<void>;

  findBySlug(slug: WorkspaceSlug): Promise<Workspace | null>;
}
