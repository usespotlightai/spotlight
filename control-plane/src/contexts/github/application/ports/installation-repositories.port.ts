import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RepositorySummary {
  readonly fullName: string;
}

export const INSTALLATION_REPOSITORIES = Symbol('INSTALLATION_REPOSITORIES');

export interface InstallationRepositoriesPort {
  list(workspaceId: WorkspaceId): Promise<RepositorySummary[]>;
}
