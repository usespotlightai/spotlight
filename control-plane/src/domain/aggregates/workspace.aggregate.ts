import { Team } from '@domain/entities/team.entity';
import { TeamCreated } from '@domain/events/team-created.event';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import type { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { TeamName } from '@domain/value-objects/team-name.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export interface WorkspaceMember {
  readonly userId: UserId;
  readonly role: WorkspaceRole;
}

/** Connecting changes how every run in the workspace reaches out. */
const MAY_CONNECT: readonly WorkspaceRole[] = ['owner', 'admin'];

export class Workspace {
  private constructor(
    readonly id: WorkspaceId,
    readonly name: WorkspaceName,
    readonly slug: WorkspaceSlug,
    readonly members: readonly WorkspaceMember[],
    readonly teams: readonly Team[],
    /** Where this workspace reaches GitHub, if anyone has connected it. */
    readonly githubInstallation: GitHubInstallation | null,
    readonly happened: readonly TeamCreated[],
  ) {}

  static create(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    newId: () => string;
  }): Workspace {
    const firstTeam = Team.create({
      name: TeamName.of(input.name.value),
      owner: input.owner,
      newId: input.newId,
    });

    return new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: 'owner' }],
      [firstTeam],
      // Connected afterwards, by whoever installs the App: a workspace is
      // worth having before it reaches anything.
      null,
      [new TeamCreated(input.id, firstTeam.id)],
    );
  }

  static rehydrate(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    members: readonly WorkspaceMember[];
    teams: readonly Team[];
    githubInstallation?: GitHubInstallation | null;
  }): Workspace {
    return new Workspace(
      input.id,
      input.name,
      input.slug,
      input.members,
      input.teams,
      input.githubInstallation ?? null,
      [],
    );
  }

  /** What this person is here, or nothing where they are not of it at all. */
  roleOf(userId: UserId): WorkspaceRole | null {
    return (
      this.members.find((each) => each.userId.equals(userId))?.role ?? null
    );
  }

  holds(userId: UserId): boolean {
    return this.roleOf(userId) !== null;
  }

  mayBeConnectedBy(userId: UserId): boolean {
    const role = this.roleOf(userId);

    return role !== null && MAY_CONNECT.includes(role);
  }

  /**
   * Reconnected as readily as connected: an App uninstalled and put back on
   * is a new installation, and the old number opens nothing.
   */
  connectedTo(installation: GitHubInstallation, by: UserId): Workspace {
    if (!this.mayBeConnectedBy(by)) {
      throw new NotYoursToConnectError(
        'This workspace is not yours to connect: only an owner or an admin may',
      );
    }

    return new Workspace(
      this.id,
      this.name,
      this.slug,
      this.members,
      this.teams,
      installation,
      this.happened,
    );
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
