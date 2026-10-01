import type { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface GitHubConnectionRepository {
  of(workspaceId: WorkspaceId): Promise<GitHubConnection>;

  claimantOf(installation: GitHubInstallation): Promise<WorkspaceId | null>;

  heldClaimantOf(installation: GitHubInstallation): Promise<WorkspaceId | null>;

  save(connection: GitHubConnection): Promise<void>;
}
