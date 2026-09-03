import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { Connection } from '@domain/value-objects/connection.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceSlugRegistry {
  isTaken(slug: WorkspaceSlug): Promise<boolean>;
}

/**
 * Where a workspace reaches its hosts, asked without loading the workspace
 * itself. Both are answers to questions a delivery or a run asks in passing:
 * whose connection this is, and what opens that workspace's side of a host.
 * Changing the answer is the workspace's own to do.
 *
 * One question for every source rather than one per source, so a host added
 * later brings its own row and needs nothing added here.
 */
export interface WorkspaceConnections {
  /** Whose word this is, asked of the identifier the host sent with it. */
  withConnection(
    source: string,
    externalId: string,
  ): Promise<WorkspaceId | null>;

  connectionTo(
    workspaceId: WorkspaceId,
    source: string,
  ): Promise<Connection | null>;
}

/** One workspace, by identity: what a team needs to reach its host. */
export interface WorkspaceFinding {
  find(workspaceId: WorkspaceId): Promise<Workspace | null>;
}

export interface WorkspaceRepository
  extends WorkspaceSlugRegistry,
    WorkspaceConnections,
    WorkspaceFinding {
  /** Throws WorkspaceSlugTakenError if the slug was claimed since isTaken. */
  add(workspace: Workspace): Promise<void>;

  save(workspace: Workspace): Promise<void>;

  findBySlug(slug: WorkspaceSlug): Promise<Workspace | null>;
}
