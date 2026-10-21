import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { WorkspaceUpdated } from '@identity/domain/events/workspace-updated.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToInviteError } from '@identity/domain/exceptions/not-yours-to-invite.error';
import { RoleAssignmentDeniedError } from '@identity/domain/exceptions/role-assignment-denied.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
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
  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      { userId: UserId.of('user_1'), role: WorkspaceRole.owner },
    ]);
  });

  it('says it was created, naming the first team it should have', () => {
    expect(build().pullEvents()).toEqual([
      new WorkspaceCreated(
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        FIRST_TEAM,
        ConfigurationChange.created(ACME, BY),
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
          { userId: OWNER, role: WorkspaceRole.owner },
          { userId: UserId.of(user), role },
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
      expect(build().administeredBy(OWNER)).toBe(true);
      expect(
        withMember(WorkspaceRole.admin).administeredBy(UserId.of('user_2')),
      ).toBe(true);
    });

    it('denies a member who is neither owner nor admin, and a stranger', () => {
      expect(
        withMember(WorkspaceRole.member).administeredBy(UserId.of('user_2')),
      ).toBe(false);
      expect(build().administeredBy(UserId.of('stranger'))).toBe(false);
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
        { userId: OWNER, role: WorkspaceRole.owner },
        { userId: ADMIN, role: WorkspaceRole.admin },
        { userId: MEMBER, role: WorkspaceRole.member },
      ],
      version: 0,
    });

    it('lets an owner or an admin administer it, and nobody else', () => {
      expect(workspace.administeredBy(OWNER)).toBe(true);
      expect(workspace.administeredBy(ADMIN)).toBe(true);
      expect(workspace.administeredBy(MEMBER)).toBe(false);
      expect(workspace.administeredBy(STRANGER)).toBe(false);
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
        members: members.map((each) => ({ userId: each.id, role: each.role })),
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
        members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
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
        ),
      ]);
    });

    it('rejects a change made against another version', () => {
      expect(() => stored(3).assertVersion(2)).toThrow(
        WorkspaceVersionConflictError,
      );
    });

    it('takes a new name, and says so', () => {
      const renamed = stored().update(
        { name: WorkspaceName.of('Acme'), slug: WorkspaceSlug.of('acme-inc') },
        BY,
      );

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
        stored().update(
          { name: WorkspaceName.of('Acme'), slug: WorkspaceSlug.of('acme') },
          BY,
        ),
      ).toThrow(ImmutableFieldError);
    });

    it('is deleted only once it has no team, no token, no OIDC trust, no issued token and nothing else', () => {
      expect(() =>
        stored().delete(
          [TeamKey.of('core')],
          [],
          [],
          [],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: team core/);
      expect(() =>
        stored().delete(
          [],
          [TokenName.of('ci')],
          [],
          [],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: token ci/);
      expect(() =>
        stored().delete(
          [],
          [],
          [OidcTrustKey.of('github-main')],
          [],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: OIDC trust github-main/);
      expect(() =>
        stored().delete(
          [],
          [],
          [],
          [OidcTrustKey.of('github-main')],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: tokens issued by github-main/);
      expect(() =>
        stored().delete(
          [],
          [],
          [],
          [],
          Dependents.of(['secret LINEAR_API_KEY']),
          BY,
        ),
      ).toThrow(/It still has: secret LINEAR_API_KEY/);

      const deleted = stored().delete([], [], [], [], Dependents.none(), BY);

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
        { userId: UserId.of('owner'), role: WorkspaceRole.owner },
        { userId: UserId.of('admin'), role: WorkspaceRole.admin },
        { userId: UserId.of('member'), role: WorkspaceRole.member },
      ],
      version: 0,
    });

    const person = (id: string) => PersonPrincipal.of(UserId.of(id));

    const token = (scopes: readonly string[], workspace = 'ws_1') =>
      TokenPrincipal.of({
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
        managesSecrets: permissions.managesSecrets,
        managesRunners: permissions.managesRunners,
        managesOidcTrusts: permissions.managesOidcTrusts,
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
      (scopes, plans, configures, managesSecrets, managesRunners, managesOidcTrusts) => {
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
        acme
          .delete([], [], [], [], Dependents.none(), BY)
          .permissionsFor(person('owner')).reads,
      ).toBe(false);
    });
  });
});
