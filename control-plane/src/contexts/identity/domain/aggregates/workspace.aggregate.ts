import { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { WorkspaceRedefined } from '@identity/domain/events/workspace-redefined.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToGiveError } from '@identity/domain/exceptions/not-yours-to-give.error';
import { NotYoursToInviteError } from '@identity/domain/exceptions/not-yours-to-invite.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import {
  type RolePositions,
  refusalToGive,
  rolesGivable,
} from '@identity/domain/services/role-giving';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import {
  PersonPrincipal,
  type Principal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WorkspaceMember {
  readonly userId: UserId;
  readonly role: WorkspaceRole;
}

interface TeamOfWorkspace {
  readonly id: TeamId;
  readonly workspaceId: WorkspaceId;
}

export class Workspace extends EventRecorder {
  private constructor(
    readonly id: WorkspaceId,
    readonly name: WorkspaceName,
    readonly slug: WorkspaceSlug,
    readonly members: readonly WorkspaceMember[],
    readonly version: number = 0,
    readonly isClosed: boolean = false,
  ) {
    super();
  }

  static open(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    owner: UserId;
    firstTeam?: { id: TeamId; name: TeamName };
    by: Attribution;
  }): Workspace {
    const opened = new Workspace(input.id, input.name, input.slug, [
      { userId: input.owner, role: WorkspaceRole.owner },
    ]);

    opened.record(
      new WorkspaceOpened(
        input.id,
        input.owner,
        input.firstTeam ?? null,
        ConfigurationChange.created(opened.whatChanged, input.by),
      ),
    );

    return opened;
  }

  static rehydrate(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    members: readonly WorkspaceMember[];
    version: number;
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
      input.version,
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceVersionConflictError(this.slug.value);
    }
  }

  redefinedAs(
    definition: { name: WorkspaceName; slug: WorkspaceSlug },
    by: Attribution,
  ): Workspace {
    this.guardOpen();

    if (!definition.slug.equals(this.slug)) {
      throw new WorkspaceSlugFixedError(
        this.slug.value,
        `cannot change its slug to ${definition.slug.value}`,
      );
    }

    const redefined = this.with({
      members: this.members,
      name: definition.name,
    });

    redefined.record(
      new WorkspaceRedefined(
        this.id,
        definition.name,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  close(
    teams: readonly TeamKey[],
    tokens: readonly TokenName[],
    trusts: readonly TokenTrustKey[],
    minting: readonly TokenTrustKey[],
    dependents: Dependents,
    by: Attribution,
  ): Workspace {
    this.guardOpen();

    const remaining = Dependents.of([
      ...teams.map((each) => `team ${each.value}`),
      ...tokens.map((each) => `token ${each.value}`),
      ...trusts.map((each) => `token trust ${each.value}`),
      ...minting.map((each) => `tokens minted through ${each.value}`),
    ]).and(dependents);

    if (!remaining.isEmpty) {
      throw new WorkspaceInUseError(this.slug.value, remaining);
    }

    const closed = this.with({ members: this.members, closed: true });

    closed.record(
      new WorkspaceClosed(
        this.id,
        this.slug,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return closed;
  }

  private guardOpen(): void {
    if (this.isClosed) {
      throw new InconsistentStateError(
        'workspace',
        'was changed after it was closed',
      );
    }
  }

  roleOf(userId: UserId): WorkspaceRole | null {
    return (
      this.members.find((each) => each.userId.equals(userId))?.role ?? null
    );
  }

  hasMember(userId: UserId): boolean {
    return this.permissionsFor(PersonPrincipal.of(userId)).reads;
  }

  administeredBy(userId: UserId): boolean {
    return this.permissionsFor(PersonPrincipal.of(userId)).administers;
  }

  permissionsFor(principal: Principal): Permissions {
    if (this.isClosed) {
      return Permissions.none;
    }

    if (principal.kind === 'token') {
      return principal.workspaceId.equals(this.id)
        ? Permissions.ofScopes(principal.scopes)
        : Permissions.none;
    }

    const role = this.roleOf(principal.userId);

    return role ? Permissions.ofRole(role) : Permissions.none;
  }

  private get whatChanged() {
    return {
      resource: 'workspace' as const,
      id: this.id.value,
      key: this.slug.value,
    };
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

  changeRole(target: UserId, role: WorkspaceRole, by: UserId): Workspace {
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

  join(userId: UserId, role: WorkspaceRole): Workspace {
    if (this.hasMember(userId)) {
      return this;
    }

    const joined = this.with({
      members: [...this.members, { userId, role }],
    });

    joined.record(new WorkspaceMemberJoined(this.id, userId, role));

    return joined;
  }

  inviteTerms(input: {
    role: WorkspaceRole;
    teams: readonly TeamId[];
    among: readonly TeamOfWorkspace[];
  }): InviteTerms {
    if (input.role.isOwner) {
      throw new NotYoursToInviteError();
    }

    const outside = input.teams.find(
      (teamId) =>
        !input.among.some(
          (team) => team.id.equals(teamId) && team.workspaceId.equals(this.id),
        ),
    );

    if (outside) {
      throw new TeamOutsideWorkspaceError(outside.value);
    }

    return InviteTerms.of(input.role, input.teams);
  }

  private with(over: {
    members: readonly WorkspaceMember[];
    name?: WorkspaceName;
    closed?: boolean;
  }): Workspace {
    const next = new Workspace(
      this.id,
      over.name ?? this.name,
      this.slug,
      over.members,
      this.version,
      over.closed ?? this.isClosed,
    );
    next.inheritEvents(this);

    return next;
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
