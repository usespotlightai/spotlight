import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_ACCESS = Symbol('WORKSPACE_ACCESS');

export type TokenScopeName =
  | 'read'
  | 'plan'
  | 'configure'
  | 'secrets'
  | 'runners'
  | 'trusts';

export interface WorkspaceMembership {
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly viewer: UserId;
  readonly isAdmin: boolean;
}

export interface TeamWorkspaceMembership extends WorkspaceMembership {
  readonly teamId: TeamId;
}

export interface WorkspacePermissions {
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly plans: boolean;
  readonly configures: boolean;
  readonly scopes: ReadonlySet<TokenScopeName>;
  readonly isAdmin: boolean;
}

export interface TeamPermissions extends WorkspacePermissions {
  readonly teamId: TeamId;
}

interface TeamAccessEntry {
  readonly teamId: TeamId;
  readonly sees: boolean;
  readonly actsOn: boolean;
}

export interface WorkspaceTeamAccess {
  readonly workspaceId: WorkspaceId;
  readonly teams: readonly TeamAccessEntry[];
}

export interface MemberTeamAccess extends WorkspaceTeamAccess {
  readonly viewer: UserId;
}

export interface WorkspaceAccessPort {
  mayView(viewer: UserId, workspaceId: WorkspaceId): Promise<boolean>;

  viewableOf(
    viewer: UserId,
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly WorkspaceId[]>;

  inWorkspace(
    slug: string,
    viewer: UserId,
  ): Promise<WorkspaceMembership | null>;

  teamAccessIn(
    slug: string,
    viewer: UserId,
  ): Promise<WorkspaceTeamAccess | null>;

  teamAccessOfMembers(
    workspaceId: WorkspaceId,
  ): Promise<readonly MemberTeamAccess[]>;

  inWorkspaceOfTeam(
    teamId: TeamId,
    viewer: UserId,
  ): Promise<TeamWorkspaceMembership | null>;

  permissionsIn(
    workspaceId: WorkspaceId,
    principal: Principal,
  ): Promise<WorkspacePermissions | null>;

  permissionsInSlug(
    slug: string,
    principal: Principal,
  ): Promise<WorkspacePermissions | null>;

  permissionsInWorkspaceOfTeam(
    teamId: TeamId,
    principal: Principal,
  ): Promise<TeamPermissions | null>;

  permissionsAsTeamMember(
    teamId: TeamId,
    principal: Principal,
  ): Promise<TeamPermissions | null>;

  mayPlan(principal: Principal): boolean;
}
