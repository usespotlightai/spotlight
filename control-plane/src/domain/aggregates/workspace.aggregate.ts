import { EventRecorder } from '@domain/aggregates/event-recorder';
import { WorkspaceConnected } from '@domain/events/workspace-connected.event';
import { WorkspaceMemberJoined } from '@domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@domain/events/workspace-member-role-changed.event';
import { InconsistentStateError } from '@domain/exceptions/inconsistent-state.error';
import { LastOwnerError } from '@domain/exceptions/last-owner.error';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import { NotYoursToGiveError } from '@domain/exceptions/not-yours-to-give.error';
import {
  type RefusalToGive,
  refusalToGive,
  rolesGivable,
  type Standing,
} from '@domain/services/role-giving';
import { Connection } from '@domain/value-objects/connection.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

const SAYING: Record<Exclude<RefusalToGive, 'last-owner'>, string> = {
  'not-a-member': 'they are not of this workspace',
  'not-yours-to-give': 'only an owner or an admin may set roles',
  'not-below-you': 'they are not below you',
  'your-own': 'your own is not yours to change',
  'above-your-rank': 'nobody hands out a rank they do not hold',
};

export interface WorkspaceMember {
  readonly userId: UserId;
  readonly role: WorkspaceRole;
}

export class Workspace extends EventRecorder {
  private constructor(
    readonly id: WorkspaceId,
    readonly name: WorkspaceName,
    readonly slug: WorkspaceSlug,
    readonly members: readonly WorkspaceMember[],
    readonly teams: readonly TeamId[],
    readonly connections: readonly Connection[],
    readonly version: number = 0,
  ) {
    super();
  }

  static open(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    firstTeam: TeamId;
  }): Workspace {
    return new Workspace(
      input.id,
      input.name,
      input.slug,
      [{ userId: input.owner, role: WorkspaceRole.owner }],
      [input.firstTeam],
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
    version?: number;
  }): Workspace {
    if (input.members.length === 0) {
      throw new InconsistentStateError('workspace', 'has no members at all');
    }
    if (!input.members.some((member) => member.role.isOwner)) {
      throw new InconsistentStateError('workspace', 'has nobody who owns it');
    }

    return new Workspace(
      input.id,
      input.name,
      input.slug,
      input.members,
      input.teams,
      input.connections ?? [],
      input.version ?? 0,
    );
  }

  roleOf(userId: UserId): WorkspaceRole | null {
    return (
      this.members.find((each) => each.userId.equals(userId))?.role ?? null
    );
  }

  holds(userId: UserId): boolean {
    return this.roleOf(userId) !== null;
  }

  mayBeConnectedBy(userId: UserId): boolean {
    return this.roleOf(userId)?.rankedAtLeast(WorkspaceRole.admin) ?? false;
  }

  maySealSecretsBy(userId: UserId): boolean {
    return this.mayBeConnectedBy(userId);
  }

  mayRevealVaultKeyBy(userId: UserId): boolean {
    return this.mayBeConnectedBy(userId);
  }

  mayProposeConfigurationBy(userId: UserId): boolean {
    return this.holds(userId);
  }

  connectionTo(source: string): Connection | null {
    return this.connections.find((each) => each.isTo(source)) ?? null;
  }

  connectedTo(connection: Connection, by: UserId): Workspace {
    if (!this.mayBeConnectedBy(by)) {
      throw new NotYoursToConnectError(
        'This workspace is not yours to connect: only an owner or an admin may',
      );
    }

    const connected = new Workspace(
      this.id,
      this.name,
      this.slug,
      this.members,
      this.teams,
      [
        ...this.connections.filter((each) => !each.isTo(connection.source)),
        connection,
      ],
      this.version,
    );

    connected.record(new WorkspaceConnected(this.id, connection));

    return connected;
  }

  // No permission check: the host has already removed the installation.
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
      this.version,
    );
  }

  private isLastOwner(userId: UserId): boolean {
    const owners = this.members.filter((each) => each.role.isOwner);

    return owners.length === 1 && owners[0]?.userId.equals(userId) === true;
  }

  private standingBetween(target: UserId, by: UserId): Standing {
    return {
      mine: this.roleOf(by),
      theirs: this.roleOf(target),
      lastOwner: this.isLastOwner(target),
      isSelf: target.equals(by),
    };
  }

  rolesGivableTo(target: UserId, by: UserId): readonly WorkspaceRole[] {
    return rolesGivable(this.standingBetween(target, by));
  }

  roleChangedTo(target: UserId, role: WorkspaceRole, by: UserId): Workspace {
    const standing = this.standingBetween(target, by);
    const refusal = refusalToGive(standing, role);

    if (refusal === 'last-owner') {
      throw new LastOwnerError();
    }
    if (refusal) {
      throw new NotYoursToGiveError(SAYING[refusal]);
    }

    const was = standing.theirs;

    if (!was || was.equals(role)) {
      return this;
    }

    const changed = this.with({
      members: this.members.map((each) =>
        each.userId.equals(target) ? { userId: each.userId, role } : each,
      ),
    });

    changed.record(
      new WorkspaceMemberRoleChanged(this.id, target, was, role, by),
    );

    return changed;
  }

  joinedBy(userId: UserId, role: WorkspaceRole): Workspace {
    if (this.holds(userId)) {
      return this;
    }

    const joined = this.with({
      members: [...this.members, { userId, role }],
    });

    joined.record(new WorkspaceMemberJoined(this.id, userId, role));

    return joined;
  }

  private with(over: { members: readonly WorkspaceMember[] }): Workspace {
    const next = new Workspace(
      this.id,
      this.name,
      this.slug,
      over.members,
      this.teams,
      this.connections,
      this.version,
    );
    next.inheritEvents(this);

    return next;
  }

  holdsTeam(teamId: TeamId): boolean {
    return this.teams.some((each) => each.equals(teamId));
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
