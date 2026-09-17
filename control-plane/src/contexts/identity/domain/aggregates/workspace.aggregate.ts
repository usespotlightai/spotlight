import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToGiveError } from '@identity/domain/exceptions/not-yours-to-give.error';
import {
  type RolePositions,
  refusalToGive,
  rolesGivable,
} from '@identity/domain/services/role-giving';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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
    readonly version: number = 0,
  ) {
    super();
  }

  static open(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    firstTeam: { id: TeamId; name: TeamName };
  }): Workspace {
    const opened = new Workspace(input.id, input.name, input.slug, [
      { userId: input.owner, role: WorkspaceRole.owner },
    ]);

    opened.record(new WorkspaceOpened(input.id, input.owner, input.firstTeam));

    return opened;
  }

  static rehydrate(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    members: readonly WorkspaceMember[];
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

  administeredBy(userId: UserId): boolean {
    return this.roleOf(userId)?.rankedAtLeast(WorkspaceRole.admin) ?? false;
  }

  private isLastOwner(userId: UserId): boolean {
    const owners = this.members.filter((each) => each.role.isOwner);

    return owners.length === 1 && owners[0]?.userId.equals(userId) === true;
  }

  private positionsBetween(target: UserId, by: UserId): RolePositions {
    return {
      mine: this.roleOf(by),
      theirs: this.roleOf(target),
      lastOwner: this.isLastOwner(target),
      isSelf: target.equals(by),
    };
  }

  rolesGivableTo(target: UserId, by: UserId): readonly WorkspaceRole[] {
    return rolesGivable(this.positionsBetween(target, by));
  }

  roleChangedTo(target: UserId, role: WorkspaceRole, by: UserId): Workspace {
    const positions = this.positionsBetween(target, by);
    const refusal = refusalToGive(positions, role);

    if (refusal === 'last-owner') {
      throw new LastOwnerError();
    }
    if (refusal) {
      throw new NotYoursToGiveError(refusal);
    }

    const was = positions.theirs;

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
      this.version,
    );
    next.inheritEvents(this);

    return next;
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
