import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceSlugRegistry {
  isTaken(slug: WorkspaceSlug): Promise<boolean>;
}

export interface WorkspaceRepository extends WorkspaceSlugRegistry {
  /** Throws WorkspaceSlugTakenError if the slug was claimed since isTaken. */
  add(workspace: Workspace): Promise<void>;
}
