import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import { WorkspaceUpdated } from '@identity/domain/events/workspace-updated.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToInviteError } from '@identity/domain/exceptions/not-yours-to-invite.error';
import { RoleAssignmentDeniedError } from '@identity/domain/exceptions/role-assignment-denied.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { WorkspaceInUseError } from '@identity/domain/exceptions/workspace-in-use.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import {
  assignableRoles,
  type RoleAssignmentContext,
  roleAssignmentDenial,
} from '@identity/domain/services/role-assignment';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import type { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
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

export interface WorkspaceDefinition {
  readonly name: WorkspaceName;
  readonly slug: WorkspaceSlug;
  readonly outboundHosts: HostAllowList;
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
    readonly outboundHosts: HostAllowList,
    readonly members: readonly WorkspaceMember[],
    readonly version: number = 0,
    readonly isDeleted: boolean = false,
  ) {
    super();
  }

  static create(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    outboundHosts?: HostAllowList;
    owner: UserId;
    firstTeam?: { id: TeamId; name: TeamName };
    by: ChangeActor;
  }): Workspace {
    const created = new Workspace(
      input.id,
      input.name,
      input.slug,
      input.outboundHosts ?? HostAllowList.none,
      [{ userId: input.owner, role: WorkspaceRole.owner }],
    );

    created.record(
      new WorkspaceCreated(
        input.id,
        input.owner,
        input.firstTeam ?? null,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: {
    id: WorkspaceId;
    name: WorkspaceName;
    slug: WorkspaceSlug;
    outboundHosts?: HostAllowList;
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
      input.outboundHosts ?? HostAllowList.none,
      input.members,
      input.version,
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceVersionConflictError(this.slug.value);
    }
  }

  update(definition: WorkspaceDefinition, by: ChangeActor): Workspace {
    this.assertNotDeleted();

    if (!definition.slug.equals(this.slug)) {
      const because = `cannot change its slug to ${definition.slug.value}`;

      throw new ImmutableFieldError(
        'slug',
        because,
        `Workspace ${this.slug.value} ${because}.`,
      );
    }

    if (this.hasDefinition(definition)) {
      return this;
    }

    const updated = this.with({
      members: this.members,
      name: definition.name,
      outboundHosts: definition.outboundHosts,
    });

    updated.record(
      new WorkspaceUpdated(
        this.id,
        definition.name,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(
    teams: readonly TeamKey[],
    tokens: readonly TokenName[],
    trusts: readonly OidcTrustKey[],
    issuing: readonly OidcTrustKey[],
    dependents: Dependents,
    by: ChangeActor,
  ): Workspace {
    this.assertNotDeleted();

    const remaining = Dependents.of([
      ...teams.map((each) => `team ${each.value}`),
      ...tokens.map((each) => `token ${each.value}`),
      ...trusts.map((each) => `OIDC trust ${each.value}`),
      ...issuing.map((each) => `tokens issued by ${each.value}`),
    ]).and(dependents);

    if (!remaining.isEmpty) {
      throw new WorkspaceInUseError(this.slug.value, remaining);
    }

    const deleted = this.with({ members: this.members, deleted: true });

    deleted.record(
      new WorkspaceDeleted(
        this.id,
        this.slug,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private hasDefinition(definition: WorkspaceDefinition): boolean {
    return (
      definition.name.equals(this.name) &&
      definition.outboundHosts.equals(this.outboundHosts)
    );
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'workspace',
        'was changed after it was deleted',
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
    return this.permissionsFor(PersonPrincipal.of(userId)).isAdmin;
  }

  permissionsFor(principal: Principal): Permissions {
    if (this.isDeleted) {
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

  private assignmentContext(target: UserId, by: UserId): RoleAssignmentContext {
    return {
      callerRole: this.roleOf(by),
      memberRole: this.roleOf(target),
      isLastOwner: this.isLastOwner(target),
      isSelf: target.equals(by),
    };
  }

  assignableRolesFor(target: UserId, by: UserId): readonly WorkspaceRole[] {
    return assignableRoles(this.assignmentContext(target, by));
  }

  changeRole(target: UserId, role: WorkspaceRole, by: UserId): Workspace {
    const context = this.assignmentContext(target, by);
    const denial = roleAssignmentDenial(context, role);

    if (denial === 'last-owner') {
      throw new LastOwnerError();
    }
    if (denial) {
      throw new RoleAssignmentDeniedError(denial);
    }

    const was = context.memberRole;

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

  inviteSpec(input: {
    role: WorkspaceRole;
    teams: readonly TeamId[];
    among: readonly TeamOfWorkspace[];
  }): InviteSpec {
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

    return InviteSpec.of(input.role, input.teams);
  }

  private with(over: {
    members: readonly WorkspaceMember[];
    name?: WorkspaceName;
    outboundHosts?: HostAllowList;
    deleted?: boolean;
  }): Workspace {
    const next = new Workspace(
      this.id,
      over.name ?? this.name,
      this.slug,
      over.outboundHosts ?? this.outboundHosts,
      over.members,
      this.version,
      over.deleted ?? this.isDeleted,
    );
    next.inheritEvents(this);

    return next;
  }

  equals(other: Workspace): boolean {
    return this.id.equals(other.id);
  }
}
