import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_DIRECTORY = Symbol('WORKSPACE_DIRECTORY');

export interface DirectoryWorkspace {
  readonly id: WorkspaceId;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly memberCount: number;
}

export interface DirectoryPageRequest {
  readonly after: string | null;
  readonly limit: number;
  readonly createdAfter: Date | null;
}

export interface DirectoryPage {
  readonly items: readonly DirectoryWorkspace[];
  readonly next: string | null;
}

// Not viewer-scoped. Use it only for callers with the admin token.
export interface WorkspaceDirectoryPort {
  // Oldest first. Pass next as after to read the page after.
  list(request: DirectoryPageRequest): Promise<DirectoryPage>;

  find(workspaceId: WorkspaceId): Promise<DirectoryWorkspace | null>;
}
