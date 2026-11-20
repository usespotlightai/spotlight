import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_DIRECTORY = Symbol('WORKSPACE_DIRECTORY');

export interface DirectoryWorkspace {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly memberCount: number;
}

export interface DirectoryRequest {
  readonly after: string | null;
  readonly limit: number;
  readonly createdAfter: Date | null;
}

export interface DirectoryPage {
  readonly items: readonly DirectoryWorkspace[];
  readonly next: string | null;
}

// Not viewer-scoped: it reads every workspace of the deployment. Use it only for callers with the admin token.
export interface WorkspaceDirectoryPort {
  // Oldest first. Pass next as after to read the page after.
  list(request: DirectoryRequest): Promise<DirectoryPage>;

  find(workspaceId: WorkspaceId): Promise<DirectoryWorkspace | null>;
}
