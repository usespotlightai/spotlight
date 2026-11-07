import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface GitHubConnectionReaderPort {
  installationOf(workspaceId: WorkspaceId): Promise<GitHubInstallation | null>;
}
