import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { WorkspaceMemberLeft } from '@identity/domain/events/workspace-member-left.event';
import { WorkspaceMemberSuspended } from '@identity/domain/events/workspace-member-suspended.event';
import { WorkspaceMemberUnsuspended } from '@identity/domain/events/workspace-member-unsuspended.event';
import { WorkspaceUpdated } from '@identity/domain/events/workspace-updated.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToInviteError } from '@identity/domain/exceptions/not-yours-to-invite.error';
import { RoleAssignmentDeniedError } from '@identity/domain/exceptions/role-assignment-denied.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import { dependentsInWorkspace } from '@identity/domain/services/workspace-contents';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { IssuedTokenGrant } from '@identity/domain/value-objects/issued-token-grant.vo';
import { Permissions } from '@identity/domain/value-objects/permissions.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenScope } from '@identity/domain/value-objects/token-scope.vo';
import { TokenScopes } from '@identity/domain/value-objects/token-scopes.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import {
  contents,
  handIssued,
  issuedBy,
  oidcTrustKeyed,
  teamAt,
} from '@identity/testing/identity.resources.fake-spec';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const BY = changeActorIn('ws_1');

const ACME = { resource: 'workspace' as const, id: 'ws_1', key: 'acme-inc' };

const FIRST_TEAM = { id: TeamId.of('team_1'), name: TeamName.of('Platform') };

const build = (id = 'ws_1') =>
  Workspace.create({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    firstTeam: FIRST_TEAM,
    by: BY,
  });

describe('Workspace', () => {
  it('is set up once the team made at sign-up exists, and not by a configured team', () => {
    const pending = build();

    expect(pending.setupStatus).toBe('pending');
    expect(pending.teamCreated('configuration')).toBe(pending);
    expect(pending.teamCreated('sign-up').setupStatus).toBe('done');
  });

  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      {
        userId: UserId.of('user_1'),
        role: WorkspaceRole.owner,
        suspendedAt: null,
      },
    ]);
  });

  it('says it was created, naming the first team it should have', () => {
    expect(build().pullEvents()).toEqual([
      new WorkspaceCreated(
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        FIRST_TEAM,
        ConfigurationChange.created(ACME, BY),
        null,
      ),
    ]);
  });

  it('is the same workspace as another that has its identity', () => {
    expect(build().equals(build())).toBe(true);
    expect(build().equals(build('ws_2'))).toBe(false);
  });

  describe('who may connect it to an integration', () => {
    const OWNER = UserId.of('user_1');

    const withMember = (role: WorkspaceRole, user = 'user_2') =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        members: [
          { userId: OWNER, role: WorkspaceRole.owner, suspendedAt: null },
          { userId: UserId.of(user), role, suspendedAt: null },
        ],
        version: 0,
      });

    it('says what a person is here, and nothing of one who is not', () => {
      const workspace = withMember(WorkspaceRole.member);

      expect(workspace.roleOf(OWNER)).toBe(WorkspaceRole.owner);
      expect(workspace.roleOf(UserId.of('user_2'))).toBe(WorkspaceRole.member);
      expect(workspace.roleOf(UserId.of('stranger'))).toBeNull();
      expect(workspace.hasMember(UserId.of('stranger'))).toBe(false);
    });

    it('lets an owner or an admin connect it', () => {
      expect(build().permissionsFor(PersonPrincipal.of(OWNER)).isAdmin).toBe(
        true,
      );
      expect(
        withMember(WorkspaceRole.admin).permissionsFor(
          PersonPrincipal.of(UserId.of('user_2')),
        ).isAdmin,
      ).toBe(true);
    });

    it('denies a member who is neither owner nor admin, and a stranger', () => {
      expect(
        withMember(WorkspaceRole.member).permissionsFor(
          PersonPrincipal.of(UserId.of('user_2')),
        ).isAdmin,
      ).toBe(false);
      expect(
        build().permissionsFor(PersonPrincipal.of(UserId.of('stranger')))
          .isAdmin,
      ).toBe(false);
    });
  });

  describe('what a person may do in it', () => {
    const OWNER = UserId.of('user_1');
    const ADMIN = UserId.of('user_2');
    const MEMBER = UserId.of('user_3');
    const STRANGER = UserId.of('stranger');

    const workspace = Workspace.rehydrate({
      id: WorkspaceId.of('ws_1'),
      name: WorkspaceName.of('Acme Inc.'),
      slug: WorkspaceSlug.of('acme-inc'),
      members: [
        { userId: OWNER, role: WorkspaceRole.owner, suspendedAt: null },
        { userId: ADMIN, role: WorkspaceRole.admin, suspendedAt: null },
        { userId: MEMBER, role: WorkspaceRole.member, suspendedAt: null },
      ],
      version: 0,
    });

    it('lets an owner or an admin administer it, and nobody else', () => {
      expect(workspace.permissionsFor(PersonPrincipal.of(OWNER)).isAdmin).toBe(
        true,
      );
      expect(workspace.permissionsFor(PersonPrincipal.of(ADMIN)).isAdmin).toBe(
        true,
      );
      expect(workspace.permissionsFor(PersonPrincipal.of(MEMBER)).isAdmin).toBe(
        false,
      );
      expect(
        workspace.permissionsFor(PersonPrincipal.of(STRANGER)).isAdmin,
      ).toBe(false);
    });

    it('has everybody of it as a member, and nobody outside it', () => {
      expect(workspace.hasMember(MEMBER)).toBe(true);
      expect(workspace.hasMember(STRANGER)).toBe(false);
    });
  });

  describe('somebody joining', () => {
    const ADA = UserId.of('user_ada');

    it('puts them on the roster at what they were offered', () => {
      const joined = build().join(ADA, WorkspaceRole.member);

      expect(joined.roleOf(ADA)).toBe(WorkspaceRole.member);
      expect(joined.hasMember(ADA)).toBe(true);
    });

    it('says so', () => {
      const created = build();
      created.pullEvents();
      const joined = created.join(ADA, WorkspaceRole.member);

      expect(joined.pullEvents()).toMatchObject([
        { kind: 'workspace.member-joined', userId: ADA },
      ]);
    });

    it('leaves somebody already of it exactly as they were', () => {
      const workspace = build().join(ADA, WorkspaceRole.admin);

      expect(workspace.join(ADA, WorkspaceRole.member)).toBe(workspace);
      expect(workspace.roleOf(ADA)).toBe(WorkspaceRole.admin);
    });
  });

  describe('inviting somebody', () => {
    const ACME_ID = WorkspaceId.of('ws_1');
    const team = (id: string, workspaceId = ACME_ID) => ({
      id: TeamId.of(id),
      workspaceId,
    });
    const AMONG = [team('team_1'), team('team_2')];
    const spec = (role: WorkspaceRole, teams = ['team_1']) =>
      build().inviteSpec({
        role,
        teams: teams.map((id) => TeamId.of(id)),
        among: AMONG,
      });

    it('offers to make them an admin or a member, on teams of its own', () => {
      expect(spec(WorkspaceRole.admin).invitedAs).toBe('admin');
      expect(
        spec(WorkspaceRole.member, ['team_1', 'team_2']).teams.map(
          (each) => each.value,
        ),
      ).toEqual(['team_1', 'team_2']);
    });

    it('offers to make nobody an owner', () => {
      expect(() => spec(WorkspaceRole.owner)).toThrow(NotYoursToInviteError);
      expect(() => spec(WorkspaceRole.owner)).toThrow(/invited as an owner/);
    });

    it('offers no team of another workspace, nor one it does not know', () => {
      expect(() =>
        build().inviteSpec({
          role: WorkspaceRole.member,
          teams: [TeamId.of('team_9')],
          among: [...AMONG, team('team_9', WorkspaceId.of('ws_2'))],
        }),
      ).toThrow(TeamOutsideWorkspaceError);
      expect(() => spec(WorkspaceRole.member, ['team_gone'])).toThrow(
        /Team team_gone is not in this workspace/,
      );
    });
  });

  describe('setting somebody’s role', () => {
    const OWNER = UserId.of('user_owner');
    const ADMIN = UserId.of('user_admin');
    const MEMBER = UserId.of('user_member');

    const staffed = (
      ...members: readonly { id: UserId; role: WorkspaceRole }[]
    ) =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: members.map((each) => ({
          userId: each.id,
          role: each.role,
          suspendedAt: null,
        })),
        version: 0,
      });

    const staff = () =>
      staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.member },
      );

    it('lets an owner raise somebody', () => {
      expect(
        staff().changeRole(MEMBER, WorkspaceRole.admin, OWNER).roleOf(MEMBER),
      ).toBe(WorkspaceRole.admin);
    });

    it('lets an owner lower somebody', () => {
      expect(
        staff().changeRole(ADMIN, WorkspaceRole.member, OWNER).roleOf(ADMIN),
      ).toBe(WorkspaceRole.member);
    });

    it('lets an owner unseat another owner', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.owner },
      );

      expect(
        two.changeRole(ADMIN, WorkspaceRole.member, OWNER).roleOf(ADMIN),
      ).toBe(WorkspaceRole.member);
    });

    it('lets an owner step down once somebody else owns it', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.owner },
      );

      expect(
        two.changeRole(OWNER, WorkspaceRole.admin, OWNER).roleOf(OWNER),
      ).toBe(WorkspaceRole.admin);
    });

    it('lets an admin set the role of somebody below them', () => {
      expect(
        staff().changeRole(MEMBER, WorkspaceRole.admin, ADMIN).roleOf(MEMBER),
      ).toBe(WorkspaceRole.admin);
    });

    it('denies an admin who changes the role of an owner', () => {
      expect(() =>
        staff().changeRole(OWNER, WorkspaceRole.member, ADMIN),
      ).toThrow(RoleAssignmentDeniedError);
    });

    it('denies an admin handing out a rank they do not have', () => {
      expect(() =>
        staff().changeRole(MEMBER, WorkspaceRole.owner, ADMIN),
      ).toThrow(/cannot assign a role above your own/);
    });

    it('denies an admin who changes the role of another admin', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.admin },
      );

      expect(() => two.changeRole(MEMBER, WorkspaceRole.member, ADMIN)).toThrow(
        /people below you/,
      );
    });

    it('denies an admin changing their own', () => {
      expect(() =>
        staff().changeRole(ADMIN, WorkspaceRole.member, ADMIN),
      ).toThrow(/cannot change your own role/);
    });

    it('denies a plain member setting anybody’s', () => {
      expect(() =>
        staff().changeRole(ADMIN, WorkspaceRole.member, MEMBER),
      ).toThrow(/Only an owner or an admin/);
    });

    it('denies somebody who is not of the workspace at all', () => {
      expect(() =>
        staff().changeRole(MEMBER, WorkspaceRole.admin, UserId.of('stranger')),
      ).toThrow(/Only an owner or an admin/);
    });

    it('denies a role for somebody who is not of the workspace', () => {
      expect(() =>
        staff().changeRole(UserId.of('stranger'), WorkspaceRole.admin, OWNER),
      ).toThrow(/not a member of this workspace/);
    });

    it('keeps the last owner, who is all that can put anything right', () => {
      expect(() =>
        staff().changeRole(OWNER, WorkspaceRole.admin, OWNER),
      ).toThrow(LastOwnerError);
    });

    it('is no change where they already have that role', () => {
      const workspace = staff();

      expect(workspace.changeRole(MEMBER, WorkspaceRole.member, ADMIN)).toBe(
        workspace,
      );
    });

    it('says whose role changed, and from what to what', () => {
      const changed = staff().changeRole(MEMBER, WorkspaceRole.admin, OWNER);

      expect(changed.pullEvents()).toMatchObject([
        {
          kind: 'workspace.member-role-changed',
          userId: MEMBER,
          was: WorkspaceRole.member,
          now: WorkspaceRole.admin,
          by: OWNER,
        },
      ]);
    });

    it('announces nothing where nothing changed', () => {
      expect(
        staff().changeRole(MEMBER, WorkspaceRole.member, ADMIN).pullEvents(),
      ).toEqual([]);
    });

    it('offers what it would allow, and nothing it would deny', () => {
      const workspace = staff();

      expect(workspace.assignableRolesFor(MEMBER, OWNER)).toEqual([
        WorkspaceRole.owner,
        WorkspaceRole.admin,
        WorkspaceRole.member,
      ]);
      expect(workspace.assignableRolesFor(MEMBER, ADMIN)).toEqual([
        WorkspaceRole.admin,
        WorkspaceRole.member,
      ]);
      expect(workspace.assignableRolesFor(OWNER, ADMIN)).toEqual([]);
      expect(workspace.assignableRolesFor(ADMIN, MEMBER)).toEqual([]);
    });

    it('offers nothing for the last owner', () => {
      expect(staff().assignableRolesFor(OWNER, OWNER)).toEqual([]);
    });

    it('leaves everybody else where they were', () => {
      const changed = staff().changeRole(MEMBER, WorkspaceRole.admin, OWNER);

      expect(changed.roleOf(OWNER)).toBe(WorkspaceRole.owner);
      expect(changed.roleOf(ADMIN)).toBe(WorkspaceRole.admin);
    });
  });

  describe('as a resource', () => {
    const stored = (version = 3) =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        members: [
          {
            userId: UserId.of('user_1'),
            role: WorkspaceRole.owner,
            suspendedAt: null,
          },
        ],
        version,
      });

    it('is created with no first team when none is requested', () => {
      const created = Workspace.create({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        owner: UserId.of('user_1'),
        by: BY,
      });

      expect(created.pullEvents()).toEqual([
        new WorkspaceCreated(
          WorkspaceId.of('ws_1'),
          UserId.of('user_1'),
          null,
          ConfigurationChange.created(ACME, BY),
          null,
        ),
      ]);
    });

    it('rejects a change made against another version', () => {
      expect(() => stored(3).assertVersion(2)).toThrow(
        WorkspaceVersionConflictError,
      );
    });

    const definition = (
      over: { name?: string; slug?: string; outboundHosts?: string[] } = {},
    ) => ({
      name: WorkspaceName.of(over.name ?? 'Acme Inc.'),
      slug: WorkspaceSlug.of(over.slug ?? 'acme-inc'),
      outboundHosts: HostAllowList.of(over.outboundHosts ?? []),
    });

    it('takes a new name, and says so', () => {
      const renamed = stored().update(definition({ name: 'Acme' }), BY);

      expect(renamed.name.value).toBe('Acme');
      expect(renamed.pullEvents()).toEqual([
        new WorkspaceUpdated(
          WorkspaceId.of('ws_1'),
          WorkspaceName.of('Acme'),
          ConfigurationChange.updated(ACME, BY),
        ),
      ]);
    });

    it('keeps its slug for its whole life', () => {
      expect(() =>
        stored().update(definition({ name: 'Acme', slug: 'acme' }), BY),
      ).toThrow(ImmutableFieldError);
    });

    it('starts with no outbound hosts of its own', () => {
      expect(stored().outboundHosts.isEmpty).toBe(true);
    });

    it('takes a new list of outbound hosts, and says so', () => {
      const listed = stored().update(
        definition({ outboundHosts: ['api.example.com', '*.acme.io'] }),
        BY,
      );

      expect(listed.outboundHosts.entries).toEqual([
        '*.acme.io',
        'api.example.com',
      ]);
      expect(listed.version).toBe(3);
      expect(listed.pullEvents()).toEqual([
        new WorkspaceUpdated(
          WorkspaceId.of('ws_1'),
          WorkspaceName.of('Acme Inc.'),
          ConfigurationChange.updated(ACME, BY),
        ),
      ]);
    });

    it('stays as it is, and says nothing, when the definition changes nothing', () => {
      const workspace = Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        outboundHosts: HostAllowList.of(['api.example.com']),
        members: [
          {
            userId: UserId.of('user_1'),
            role: WorkspaceRole.owner,
            suspendedAt: null,
          },
        ],
        version: 3,
      });
      const unchanged = workspace.update(
        definition({ outboundHosts: ['API.example.com'] }),
        BY,
      );

      expect(unchanged).toBe(workspace);
      expect(unchanged.pullEvents()).toEqual([]);
    });

    it('is deleted only once it has no team, no token, no OIDC trust, no issued token and nothing else', () => {
      const trust = oidcTrustKeyed('github-main');

      expect(() =>
        stored().delete(
          dependentsInWorkspace(contents({ teams: [teamAt(0, 'core')] })),
          BY,
        ),
      ).toThrow(/It still has: team core/);
      expect(() =>
        stored().delete(
          dependentsInWorkspace(contents({ tokens: [handIssued('ci')] })),
          BY,
        ),
      ).toThrow(/It still has: token ci/);
      expect(() =>
        stored().delete(
          dependentsInWorkspace(contents({ trusts: [trust] })),
          BY,
        ),
      ).toThrow(/It still has: OIDC trust github-main/);
      expect(() =>
        stored().delete(
          dependentsInWorkspace(contents({ tokens: [issuedBy(trust)] })),
          BY,
        ),
      ).toThrow(/It still has: tokens issued by a deleted OIDC trust$/);
      expect(() =>
        stored().delete(
          dependentsInWorkspace(
            contents({ tokens: [issuedBy(trust)], trusts: [trust] }),
          ),
          BY,
        ),
      ).toThrow(/OIDC trust github-main, tokens issued by github-main$/);
      expect(() =>
        stored().delete(
          Dependents.of([{ kind: 'secret', key: 'LINEAR_API_KEY' }]),
          BY,
        ),
      ).toThrow(/It still has: secret LINEAR_API_KEY/);

      const deleted = stored().delete(Dependents.none(), BY);

      expect(deleted.isDeleted).toBe(true);
      expect(deleted.pullEvents()).toEqual([
        new WorkspaceDeleted(
          WorkspaceId.of('ws_1'),
          WorkspaceSlug.of('acme-inc'),
          ConfigurationChange.deleted(ACME, BY),
        ),
      ]);
    });
  });

  describe('what a principal may do in it', () => {
    const acme = Workspace.rehydrate({
      id: WorkspaceId.of('ws_1'),
      name: WorkspaceName.of('Acme Inc.'),
      slug: WorkspaceSlug.of('acme-inc'),
      members: [
        {
          userId: UserId.of('owner'),
          role: WorkspaceRole.owner,
          suspendedAt: null,
        },
        {
          userId: UserId.of('admin'),
          role: WorkspaceRole.admin,
          suspendedAt: null,
        },
        {
          userId: UserId.of('member'),
          role: WorkspaceRole.member,
          suspendedAt: null,
        },
      ],
      version: 0,
    });

    const person = (id: string) => PersonPrincipal.of(UserId.of(id));

    const token = (scopes: readonly string[], workspace = 'ws_1') =>
      IssuedTokenGrant.principal({
        tokenId: WorkspaceTokenId.of('token_1'),
        workspaceId: WorkspaceId.of(workspace),
        scopes: TokenScopes.named(scopes),
        issuedBy: UserId.of('admin'),
      });

    const permissionsOf = (principal: PersonPrincipal | TokenPrincipal) => {
      const permissions = acme.permissionsFor(principal);

      return {
        reads: permissions.reads,
        plans: permissions.plans,
        configures: permissions.configures,
        managesSecrets: permissions.allows(TokenScope.secrets),
        managesRunners: permissions.allows(TokenScope.runners),
        managesOidcTrusts: permissions.allows(TokenScope.trusts),
        isAdmin: permissions.isAdmin,
      };
    };

    it.each([
      ['owner', true, true],
      ['admin', true, true],
      ['member', false, false],
    ])(
      'lets its %s read and plan, configuring, managing secrets, runners and OIDC trusts, and administering only as an admin',
      (who, configures, isAdmin) => {
        expect(permissionsOf(person(who))).toEqual({
          reads: true,
          plans: true,
          configures,
          managesSecrets: configures,
          managesRunners: configures,
          managesOidcTrusts: configures,
          isAdmin,
        });
      },
    );

    it('clears nothing for someone outside it', () => {
      expect(permissionsOf(person('stranger'))).toEqual({
        reads: false,
        plans: false,
        configures: false,
        managesSecrets: false,
        managesRunners: false,
        managesOidcTrusts: false,
        isAdmin: false,
      });
    });

    it.each([
      [['read'], false, false, false, false, false],
      [['plan'], true, false, false, false, false],
      [['configure'], true, true, false, false, false],
      [['configure', 'secrets'], true, true, true, false, false],
      [['configure', 'runners'], true, true, false, true, false],
      [['configure', 'trusts'], true, true, false, false, true],
    ])(
      'lets a %j token of its own read, and never administer',
      (
        scopes,
        plans,
        configures,
        managesSecrets,
        managesRunners,
        managesOidcTrusts,
      ) => {
        expect(permissionsOf(token(scopes))).toEqual({
          reads: true,
          plans,
          configures,
          managesSecrets,
          managesRunners,
          managesOidcTrusts,
          isAdmin: false,
        });
      },
    );

    it('clears nothing for a token of another workspace, whatever its scope', () => {
      expect(permissionsOf(token(['configure', 'secrets'], 'ws_2'))).toEqual({
        reads: false,
        plans: false,
        configures: false,
        managesSecrets: false,
        managesRunners: false,
        managesOidcTrusts: false,
        isAdmin: false,
      });
    });

    it('clears nothing once it is deleted', () => {
      expect(
        acme.delete(Dependents.none(), BY).permissionsFor(person('owner'))
          .reads,
      ).toBe(false);
    });
  });

  describe('suspending somebody', () => {
    const OWNER = UserId.of('user_owner');
    const OTHER_OWNER = UserId.of('user_owner_2');
    const ADMIN = UserId.of('user_admin');
    const OTHER_ADMIN = UserId.of('user_admin_2');
    const MEMBER = UserId.of('user_member');
    const AT = new Date('2026-11-20T10:00:00.000Z');

    const staffed = (
      ...members: readonly {
        id: UserId;
        role: WorkspaceRole;
        suspendedAt?: Date;
      }[]
    ) =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: members.map((each) => ({
          userId: each.id,
          role: each.role,
          suspendedAt: each.suspendedAt ?? null,
        })),
        version: 0,
      });

    const staff = () =>
      staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: OTHER_OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: OTHER_ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.member },
      );

    it('lets an owner suspend anybody else', () => {
      for (const target of [OTHER_OWNER, ADMIN, MEMBER]) {
        expect(staff().suspend(target, OWNER, AT).isSuspended(target)).toBe(
          true,
        );
      }
    });

    it('lets an admin suspend a member or another admin', () => {
      for (const target of [OTHER_ADMIN, MEMBER]) {
        expect(staff().suspend(target, ADMIN, AT).isSuspended(target)).toBe(
          true,
        );
      }
    });

    it('denies an admin who suspends an owner', () => {
      expect(() => staff().suspend(OWNER, ADMIN, AT)).toThrow(
        new RoleAssignmentDeniedError('suspend-above-your-rank'),
      );
    });

    it('denies a plain member who suspends anybody', () => {
      expect(() => staff().suspend(ADMIN, MEMBER, AT)).toThrow(
        new RoleAssignmentDeniedError('not-an-admin-to-suspend'),
      );
    });

    it('denies somebody who suspends themselves', () => {
      expect(() => staff().suspend(ADMIN, ADMIN, AT)).toThrow(
        new RoleAssignmentDeniedError('suspend-your-own'),
      );
    });

    it('denies somebody who is not of the workspace', () => {
      expect(() => staff().suspend(MEMBER, UserId.of('stranger'), AT)).toThrow(
        new RoleAssignmentDeniedError('not-an-admin-to-suspend'),
      );
      expect(() => staff().suspend(UserId.of('stranger'), OWNER, AT)).toThrow(
        new RoleAssignmentDeniedError('not-a-member'),
      );
    });

    it('denies a suspended admin', () => {
      const suspended = staff().suspend(ADMIN, OWNER, AT);

      expect(() => suspended.suspend(MEMBER, ADMIN, AT)).toThrow(
        new RoleAssignmentDeniedError('not-an-admin-to-suspend'),
      );
    });

    it('keeps the last owner', () => {
      const sole = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
      );

      expect(() => sole.suspend(OWNER, OWNER, AT)).toThrow(LastOwnerError);
      expect(() => sole.suspend(OWNER, ADMIN, AT)).toThrow(
        new RoleAssignmentDeniedError('suspend-above-your-rank'),
      );
    });

    it('counts only owners with access as owners', () => {
      const suspended = staff().suspend(OTHER_OWNER, OWNER, AT);

      expect(() => suspended.suspend(OWNER, OWNER, AT)).toThrow(LastOwnerError);
      expect(() => suspended.leave(OWNER, AT)).toThrow(LastOwnerError);
    });

    it('takes every permission from them and keeps their role to show', () => {
      const suspended = staff().suspend(ADMIN, OWNER, AT);

      expect(suspended.permissionsFor(PersonPrincipal.of(ADMIN))).toEqual(
        Permissions.none,
      );
      expect(suspended.hasMember(ADMIN)).toBe(false);
      expect(suspended.roleOf(ADMIN)).toBe(WorkspaceRole.admin);
      expect(suspended.members).toHaveLength(5);
    });

    it('says who suspended whom, and when', () => {
      const suspended = staff().suspend(MEMBER, ADMIN, AT);

      expect(suspended.pullEvents()).toEqual([
        new WorkspaceMemberSuspended(WorkspaceId.of('ws_1'), MEMBER, ADMIN, AT),
      ]);
    });

    it('is no change, and says nothing, for somebody already suspended', () => {
      const suspended = staff().suspend(MEMBER, ADMIN, AT);
      const again = suspended.suspend(MEMBER, OWNER, new Date());

      suspended.pullEvents();

      expect(again.pullEvents()).toEqual([]);
      expect(again.members).toEqual(suspended.members);
    });

    it('refuses to change the role of somebody suspended', () => {
      const suspended = staff().suspend(MEMBER, ADMIN, AT);

      expect(() =>
        suspended.changeRole(MEMBER, WorkspaceRole.admin, OWNER),
      ).toThrow(new RoleAssignmentDeniedError('suspended-member'));
      expect(suspended.assignableRolesFor(MEMBER, OWNER)).toEqual([]);
    });

    it('offers what it would allow, and nothing it would deny', () => {
      const workspace = staff();

      expect(workspace.mayBeSuspended(MEMBER, ADMIN)).toBe(true);
      expect(workspace.mayBeSuspended(OWNER, ADMIN)).toBe(false);
      expect(workspace.mayBeSuspended(ADMIN, ADMIN)).toBe(false);
      expect(workspace.mayBeSuspended(ADMIN, MEMBER)).toBe(false);
      expect(workspace.mayBeUnsuspended(MEMBER, ADMIN)).toBe(false);
    });

    it('invites nobody who is on the roster, suspended or not', () => {
      const suspended = staff().suspend(MEMBER, ADMIN, AT);

      expect(suspended.isListed(MEMBER)).toBe(true);
      expect(suspended.join(MEMBER, WorkspaceRole.admin)).toBe(suspended);
    });
  });

  describe('unsuspending somebody', () => {
    const OWNER = UserId.of('user_owner');
    const ADMIN = UserId.of('user_admin');
    const MEMBER = UserId.of('user_member');
    const AT = new Date('2026-11-20T10:00:00.000Z');
    const LATER = new Date('2026-11-21T10:00:00.000Z');

    const suspended = () =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: [
          { userId: OWNER, role: WorkspaceRole.owner, suspendedAt: null },
          { userId: ADMIN, role: WorkspaceRole.admin, suspendedAt: null },
          { userId: MEMBER, role: WorkspaceRole.member, suspendedAt: AT },
        ],
        version: 0,
      });

    it('gives back the role and the access they had', () => {
      const restored = suspended().unsuspend(MEMBER, ADMIN, LATER);

      expect(restored.isSuspended(MEMBER)).toBe(false);
      expect(restored.roleOf(MEMBER)).toBe(WorkspaceRole.member);
      expect(restored.permissionsFor(PersonPrincipal.of(MEMBER)).reads).toBe(
        true,
      );
    });

    it('says who unsuspended whom, and when', () => {
      expect(suspended().unsuspend(MEMBER, ADMIN, LATER).pullEvents()).toEqual([
        new WorkspaceMemberUnsuspended(
          WorkspaceId.of('ws_1'),
          MEMBER,
          ADMIN,
          LATER,
        ),
      ]);
    });

    it('denies a plain member, and somebody suspended', () => {
      const workspace = suspended();

      expect(() => workspace.unsuspend(MEMBER, MEMBER, LATER)).toThrow(
        RoleAssignmentDeniedError,
      );
      expect(() =>
        workspace.suspend(ADMIN, OWNER, AT).unsuspend(MEMBER, ADMIN, LATER),
      ).toThrow(RoleAssignmentDeniedError);
    });

    it('is no change for somebody who has access', () => {
      const workspace = suspended();

      expect(workspace.unsuspend(ADMIN, OWNER, LATER)).toBe(workspace);
    });

    it('offers it only for somebody suspended', () => {
      const workspace = suspended();

      expect(workspace.mayBeUnsuspended(MEMBER, ADMIN)).toBe(true);
      expect(workspace.mayBeUnsuspended(ADMIN, OWNER)).toBe(false);
      expect(workspace.mayBeUnsuspended(MEMBER, MEMBER)).toBe(false);
    });
  });

  describe('somebody leaving', () => {
    const OWNER = UserId.of('user_owner');
    const MEMBER = UserId.of('user_member');
    const AT = new Date('2026-11-20T10:00:00.000Z');

    const staffed = (owners: number) =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: [
          { userId: OWNER, role: WorkspaceRole.owner, suspendedAt: null },
          ...(owners > 1
            ? [
                {
                  userId: UserId.of('user_owner_2'),
                  role: WorkspaceRole.owner,
                  suspendedAt: null,
                },
              ]
            : []),
          { userId: MEMBER, role: WorkspaceRole.member, suspendedAt: null },
        ],
        version: 0,
      });

    it('takes their access and keeps them on the roster, dated', () => {
      const left = staffed(1).leave(MEMBER, AT);

      expect(left.hasMember(MEMBER)).toBe(false);
      expect(left.members.find((each) => each.userId.equals(MEMBER))).toEqual({
        userId: MEMBER,
        role: WorkspaceRole.member,
        suspendedAt: AT,
      });
    });

    it('says who left, and when', () => {
      expect(staffed(1).leave(MEMBER, AT).pullEvents()).toEqual([
        new WorkspaceMemberLeft(WorkspaceId.of('ws_1'), MEMBER, AT),
      ]);
    });

    it('lets an owner go once another owner stays', () => {
      expect(staffed(2).leave(OWNER, AT).hasMember(OWNER)).toBe(false);
    });

    it('keeps the last owner', () => {
      expect(() => staffed(1).leave(OWNER, AT)).toThrow(LastOwnerError);
    });

    it('denies somebody who is not of the workspace, or already suspended', () => {
      const workspace = staffed(1);

      expect(() => workspace.leave(UserId.of('stranger'), AT)).toThrow(
        new RoleAssignmentDeniedError('not-a-member'),
      );
      expect(() =>
        workspace.suspend(MEMBER, OWNER, AT).leave(MEMBER, AT),
      ).toThrow(new RoleAssignmentDeniedError('not-a-member'));
    });

    it('offers it to everybody but the last owner', () => {
      const workspace = staffed(1);

      expect(workspace.mayLeave(MEMBER)).toBe(true);
      expect(workspace.mayLeave(OWNER)).toBe(false);
      expect(staffed(2).mayLeave(OWNER)).toBe(true);
    });

    it('can be undone by an owner', () => {
      const restored = staffed(1)
        .leave(MEMBER, AT)
        .unsuspend(MEMBER, OWNER, new Date());

      expect(restored.hasMember(MEMBER)).toBe(true);
    });
  });
});
