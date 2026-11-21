import type { Page } from '@shared-kernel/application/dto/page.dto';
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
  // Only the workspaces created at or after this time.
  readonly since: Date | null;
}

// Not viewer-scoped. Use it only for work of the whole deployment, such as the admin API and the reconcilers that run at start.
export interface WorkspaceDirectoryPort {
  // Oldest first. Pass next as after to read the page after.
  list(request: DirectoryPageRequest): Promise<Page<DirectoryWorkspace>>;

  find(workspaceId: WorkspaceId): Promise<DirectoryWorkspace | null>;
}
