import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { Connection } from '@domain/value-objects/connection.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceSlugRegistry {
  isTaken(slug: WorkspaceSlug): Promise<boolean>;
}

export interface WorkspaceConnections {
  withConnection(
    source: string,
    externalId: string,
  ): Promise<WorkspaceId | null>;

  connectionTo(
    workspaceId: WorkspaceId,
    source: string,
  ): Promise<Connection | null>;
}

export interface WorkspaceFinding {
  find(workspaceId: WorkspaceId): Promise<Workspace | null>;
}

export interface WorkspaceRepository
  extends WorkspaceSlugRegistry,
    WorkspaceConnections,
    WorkspaceFinding {
  // Throws WorkspaceSlugTakenError if the slug was claimed since isTaken.
  add(workspace: Workspace): Promise<void>;

  save(workspace: Workspace): Promise<void>;

  findBySlug(slug: WorkspaceSlug): Promise<Workspace | null>;
}
