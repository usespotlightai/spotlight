import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface WorkspaceListing {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: WorkspaceRoleName;
}

interface TeamSummary {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamSummary[];
  readonly role: WorkspaceRoleName;
}

export interface WorkspaceProfile {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export const WORKSPACE_READER = Symbol('WORKSPACE_READER');

export interface WorkspaceReaderPort {
  listForMember(userId: UserId): Promise<WorkspaceListing[]>;

  // Not viewer-scoped. Use it only for webhook callers with a verified signature.
  identify(slug: string): Promise<string | null>;

  slugOf(workspaceId: string): Promise<string | null>;

  profileOf(workspaceId: string): Promise<WorkspaceProfile | null>;

  isOpen(workspaceId: string): Promise<boolean>;

  // Not viewer-scoped. Use it only for webhook callers with a verified signature.
  identifyTeam(
    slug: string,
    teamKey: string,
  ): Promise<{ workspaceId: string; teamId: string } | null>;

  findTeamForMember(
    teamId: string,
    userId: UserId,
  ): Promise<{
    workspaceId: string;
    teamId: string;
    teamKey: string;
    slug: string;
  } | null>;

  findForMember(slug: string, userId: UserId): Promise<WorkspaceDetail | null>;
}
