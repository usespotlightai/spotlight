import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';

export interface WorkspaceListing {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: WorkspaceRole;
}

export interface TeamSummary {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamSummary[];
}

export const WORKSPACE_READER = Symbol('WORKSPACE_READER');

export interface WorkspaceReaderPort {
  listForMember(userId: UserId): Promise<WorkspaceListing[]>;

  findForMember(slug: string, userId: UserId): Promise<WorkspaceDetail | null>;
}
