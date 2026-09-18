import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const INSTALLATIONS = Symbol('GITHUB_INSTALLATIONS');

export interface InstallationsPort {
  of(workspaceId: WorkspaceId): Promise<GitHubInstallation>;

  maybe(workspaceId: WorkspaceId): Promise<GitHubInstallation | null>;
}
