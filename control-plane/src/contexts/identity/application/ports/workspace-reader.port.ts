import type { TeamSummary } from '@identity/application/ports/workspace-records.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type WorkspaceRoleName = 'owner' | 'admin' | 'member';

export type WorkspaceSetupStatus = 'pending' | 'done';

export type TeamOriginName = 'sign-up' | 'configuration';

export interface WorkspaceListing {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: WorkspaceRoleName;
}

export interface WorkspaceDetail {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamSummary[];
  readonly role: WorkspaceRoleName;
  readonly setupStatus: WorkspaceSetupStatus;
}

export interface WorkspaceProfile {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly outboundHosts: readonly string[];
}

export const WORKSPACE_READER = Symbol('WORKSPACE_READER');

export interface WorkspaceReaderPort {
  listForMember(userId: UserId): Promise<WorkspaceListing[]>;

  // Not viewer-scoped. Use it only for webhook callers with a verified signature.
  idForSlug(slug: string): Promise<string | null>;

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
    origin: TeamOriginName;
  } | null>;

  findForMember(slug: string, userId: UserId): Promise<WorkspaceDetail | null>;
}
