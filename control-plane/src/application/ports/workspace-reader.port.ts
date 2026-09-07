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

  /**
   * Which workspace a slug names, asked without a person asking it. A host
   * knocking at a workspace's door has no session to be read from, and the
   * signature it carries is what stands in for one.
   */
  identify(slug: string): Promise<string | null>;

  /** The slug a workspace goes by, for building a link back into the app. */
  slugOf(workspaceId: string): Promise<string | null>;

  /**
   * Which team a workspace's slug and a team's key name between them, asked
   * without a person asking it. A host knocking at a team's door has no
   * session to be read from, and the signature it carries stands in for one.
   */
  identifyTeam(
    slug: string,
    teamKey: string,
  ): Promise<{ workspaceId: string; teamId: string } | null>;

  /** That team as one of the caller's, or nothing where it is not. */
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
