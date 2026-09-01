import type { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceSlugRegistry {
  isTaken(slug: WorkspaceSlug): Promise<boolean>;
}

/**
 * Where a workspace reaches GitHub, asked without loading the workspace
 * itself. Both are answers to questions a delivery or a run asks in passing:
 * whose installation this is, and what opens that workspace's repositories.
 * Changing the answer is the workspace's own to do.
 */
export interface GitHubInstallations {
  withInstallation(
    installation: GitHubInstallation,
  ): Promise<WorkspaceId | null>;

  installationOf(workspaceId: WorkspaceId): Promise<GitHubInstallation | null>;
}

export interface WorkspaceRepository
  extends WorkspaceSlugRegistry,
    GitHubInstallations {
  /** Throws WorkspaceSlugTakenError if the slug was claimed since isTaken. */
  add(workspace: Workspace): Promise<void>;

  save(workspace: Workspace): Promise<void>;

  findBySlug(slug: WorkspaceSlug): Promise<Workspace | null>;
}
