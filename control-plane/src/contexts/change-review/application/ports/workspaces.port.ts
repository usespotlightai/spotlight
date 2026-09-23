import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACES = Symbol('CHANGE_REVIEW_WORKSPACES');

export interface WorkspacesPort {
  slugOf(workspaceId: WorkspaceId): Promise<string | null>;

  idOf(slug: string): Promise<WorkspaceId | null>;

  mayView(viewer: UserId, workspaceId: WorkspaceId): Promise<boolean>;
}
