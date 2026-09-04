import { WorkspaceConnected } from '@domain/events/workspace-connected.event';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import { Connection } from '@domain/value-objects/connection.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

/** What a workspace can say has happened to it. */
export type WorkspaceHappening = WorkspaceConnected;

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
    /** Its teams, by identity: each is its own to load and to change. */
    readonly teams: readonly TeamId[],
    /** Every host this workspace has been connected to, at most one each. */
    readonly connections: readonly Connection[],
    readonly happened: readonly WorkspaceHappening[],
  ) {}

  static create(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    /** The team it opens with, made alongside it and belonging to it. */
    firstTeam: TeamId;
  }): Workspace {
    return new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: 'owner' }],
      [input.firstTeam],
      // Connected afterwards, by whoever installs the App: a workspace is
      // worth having before it reaches anything.
      [],
      [],
    );
  }

  static rehydrate(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    members: readonly WorkspaceMember[];
    teams: readonly TeamId[];
    connections?: readonly Connection[];
  }): Workspace {
    return new Workspace(
      input.id,
      input.name,
      input.slug,
      input.members,
      input.teams,
      input.connections ?? [],
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

  connectionTo(source: string): Connection | null {
    return this.connections.find((each) => each.isTo(source)) ?? null;
  }

  /**
   * Reconnected as readily as connected: an App uninstalled and put back on
   * is a new installation, and the old number opens nothing. One host at a
   * time, so connecting again replaces rather than adds.
   */
  connectedTo(connection: Connection, by: UserId): Workspace {
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
      [
        ...this.connections.filter((each) => !each.isTo(connection.source)),
        connection,
      ],
      // Said out loud: what should follow from connecting is not connecting's
      // business, and a workspace that reaches a new host is worth hearing.
      [...this.happened, new WorkspaceConnected(this.id, connection)],
    );
  }

  /**
   * The host let go of, because the host said so. Nobody's permission is
   * asked: an installation somebody removed on GitHub is gone whether or not
   * the person who removed it could have removed it from here.
   */
  disconnectedFrom(source: string): Workspace {
    if (!this.connectionTo(source)) {
      return this;
    }

    return new Workspace(
      this.id,
      this.name,
      this.slug,
      this.members,
      this.teams,
      this.connections.filter((each) => !each.isTo(source)),
      this.happened,
    );
  }

  holdsTeam(teamId: TeamId): boolean {
    return this.teams.some((each) => each.equals(teamId));
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
