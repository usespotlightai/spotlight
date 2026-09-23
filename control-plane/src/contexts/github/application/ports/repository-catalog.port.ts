import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RepositorySummary {
  readonly fullName: string;
}

export const REPOSITORY_CATALOG = Symbol('REPOSITORY_CATALOG');

export interface RepositoryCatalogPort {
  list(workspaceId: WorkspaceId): Promise<RepositorySummary[]>;
}
