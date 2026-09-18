import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const GITHUB_APP = Symbol('GITHUB_APP');

export interface GitHubAppPort {
  installUrl(): Promise<string | null>;

  owner(workspaceId: WorkspaceId): Promise<string | null>;
}
