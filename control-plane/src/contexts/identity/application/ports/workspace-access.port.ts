import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_ACCESS = Symbol('WORKSPACE_ACCESS');

export interface WorkspaceMembership {
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly viewer: UserId;
  readonly administers: boolean;
}

export interface TeamMembership extends WorkspaceMembership {
  readonly teamId: TeamId;
}

export interface WorkspaceClearance {
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly configures: boolean;
  readonly managesSecrets: boolean;
  readonly managesRunners: boolean;
  readonly managesTokenTrusts: boolean;
  readonly administers: boolean;
}

export interface TeamClearance extends WorkspaceClearance {
  readonly teamId: TeamId;
}

export interface WorkspaceAccessPort {
  viewableBy(
    viewer: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlySet<string>>;

  mayView(viewer: UserId, workspaceId: WorkspaceId): Promise<boolean>;

  inWorkspace(
    slug: string,
    viewer: UserId,
  ): Promise<WorkspaceMembership | null>;

  onTeam(teamId: string, viewer: UserId): Promise<TeamMembership | null>;

  clearanceIn(
    workspaceId: WorkspaceId,
    principal: Principal,
  ): Promise<WorkspaceClearance | null>;

  clearanceOnTeam(
    teamId: string,
    principal: Principal,
  ): Promise<TeamClearance | null>;

  clearanceAsTeamReader(
    teamId: string,
    principal: Principal,
  ): Promise<TeamClearance | null>;

  mayPlan(principal: Principal): boolean;
}
