import type { TeamSummary } from '@identity/application/ports/workspace-records.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type WorkspaceRoleName = 'owner' | 'admin' | 'member';

type WorkspaceSetupStatus = 'pending' | 'done';

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

export interface IdentifiedTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export const WORKSPACE_READER = Symbol('WORKSPACE_READER');

export interface WorkspaceReaderPort {
  listForMember(userId: UserId): Promise<WorkspaceListing[]>;

  // Not viewer-scoped. Use it only for webhook callers with a verified signature.
  idForSlug(slug: string): Promise<WorkspaceId | null>;

  slugOf(workspaceId: WorkspaceId): Promise<string | null>;

  profileOf(workspaceId: WorkspaceId): Promise<WorkspaceProfile | null>;

  isOpen(workspaceId: WorkspaceId): Promise<boolean>;

  // Not viewer-scoped. Use it only for webhook callers with a verified signature.
  identifyTeam(slug: string, teamKey: string): Promise<IdentifiedTeam | null>;

  findTeamForViewer(
    teamId: TeamId,
    userId: UserId,
  ): Promise<{
    workspaceId: WorkspaceId;
    teamId: TeamId;
    teamKey: string;
    slug: string;
    origin: TeamOriginName;
  } | null>;

  findForMember(slug: string, userId: UserId): Promise<WorkspaceDetail | null>;
}
