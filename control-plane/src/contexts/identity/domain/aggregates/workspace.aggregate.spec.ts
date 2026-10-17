import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { WorkspaceRedefined } from '@identity/domain/events/workspace-redefined.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToGiveError } from '@identity/domain/exceptions/not-yours-to-give.error';
import { NotYoursToInviteError } from '@identity/domain/exceptions/not-yours-to-invite.error';
import { TeamOutsideWorkspaceError } from '@identity/domain/exceptions/team-outside-workspace.error';
import { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import { WorkspaceVersionConflictError } from '@identity/domain/exceptions/workspace-version-conflict.error';
import { Dependents } from '@identity/domain/value-objects/dependents.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
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

const BY = attributedIn('ws_1');

const ACME = { resource: 'workspace' as const, id: 'ws_1', key: 'acme-inc' };

const FIRST_TEAM = { id: TeamId.of('team_1'), name: TeamName.of('Platform') };

const build = (id = 'ws_1') =>
  Workspace.open({
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

  it('says it opened, naming the first team it should have', () => {
    expect(build().pullEvents()).toEqual([
      new WorkspaceOpened(
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

  describe('who may connect it to a host', () => {
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

    it('refuses a member who is neither owner nor admin, and a stranger', () => {
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
      const opened = build();
      opened.pullEvents();
      const joined = opened.join(ADA, WorkspaceRole.member);

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
    const terms = (role: WorkspaceRole, teams = ['team_1']) =>
      build().inviteTerms({
        role,
        teams: teams.map((id) => TeamId.of(id)),
        among: AMONG,
      });

    it('offers to make them an admin or a member, on teams of its own', () => {
      expect(terms(WorkspaceRole.admin).invitedAs).toBe('admin');
      expect(
        terms(WorkspaceRole.member, ['team_1', 'team_2']).teams.map(
          (each) => each.value,
        ),
      ).toEqual(['team_1', 'team_2']);
    });

    it('offers to make nobody an owner', () => {
      expect(() => terms(WorkspaceRole.owner)).toThrow(NotYoursToInviteError);
      expect(() => terms(WorkspaceRole.owner)).toThrow(/invited as an owner/);
    });

    it('offers no team of another workspace, nor one it does not know', () => {
      expect(() =>
        build().inviteTerms({
          role: WorkspaceRole.member,
          teams: [TeamId.of('team_9')],
          among: [...AMONG, team('team_9', WorkspaceId.of('ws_2'))],
        }),
      ).toThrow(TeamOutsideWorkspaceError);
      expect(() => terms(WorkspaceRole.member, ['team_gone'])).toThrow(
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

    it('refuses an admin reaching an owner', () => {
      expect(() =>
        staff().changeRole(OWNER, WorkspaceRole.member, ADMIN),
      ).toThrow(NotYoursToGiveError);
    });

    it('refuses an admin handing out a rank they do not have', () => {
      expect(() =>
        staff().changeRole(MEMBER, WorkspaceRole.owner, ADMIN),
      ).toThrow(/cannot give a role above your own/);
    });

    it('refuses an admin reaching another admin', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.admin },
      );

      expect(() => two.changeRole(MEMBER, WorkspaceRole.member, ADMIN)).toThrow(
        /people below you/,
      );
    });

    it('refuses an admin changing their own', () => {
      expect(() =>
        staff().changeRole(ADMIN, WorkspaceRole.member, ADMIN),
      ).toThrow(/cannot change your own role/);
    });

    it('refuses a plain member setting anybody’s', () => {
      expect(() =>
        staff().changeRole(ADMIN, WorkspaceRole.member, MEMBER),
      ).toThrow(/Only an owner or an admin/);
    });

    it('refuses somebody who is not of the workspace at all', () => {
      expect(() =>
        staff().changeRole(MEMBER, WorkspaceRole.admin, UserId.of('stranger')),
      ).toThrow(/Only an owner or an admin/);
    });

    it('refuses a role for somebody who is not of the workspace', () => {
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

    it('offers what it would allow, and nothing it would refuse', () => {
      const workspace = staff();

      expect(workspace.rolesGivableTo(MEMBER, OWNER)).toEqual([
        WorkspaceRole.owner,
        WorkspaceRole.admin,
        WorkspaceRole.member,
      ]);
      expect(workspace.rolesGivableTo(MEMBER, ADMIN)).toEqual([
        WorkspaceRole.admin,
        WorkspaceRole.member,
      ]);
      expect(workspace.rolesGivableTo(OWNER, ADMIN)).toEqual([]);
      expect(workspace.rolesGivableTo(ADMIN, MEMBER)).toEqual([]);
    });

    it('offers nothing for the last owner', () => {
      expect(staff().rolesGivableTo(OWNER, OWNER)).toEqual([]);
    });

    it('leaves everybody else where they were', () => {
      const changed = staff().changeRole(MEMBER, WorkspaceRole.admin, OWNER);

      expect(changed.roleOf(OWNER)).toBe(WorkspaceRole.owner);
      expect(changed.roleOf(ADMIN)).toBe(WorkspaceRole.admin);
    });
  });

  describe('as a resource', () => {
    const kept = (version = 3) =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
        version,
      });

    it('opens with no first team when none is asked for', () => {
      const opened = Workspace.open({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme Inc.'),
        slug: WorkspaceSlug.of('acme-inc'),
        owner: UserId.of('user_1'),
        by: BY,
      });

      expect(opened.pullEvents()).toEqual([
        new WorkspaceOpened(
          WorkspaceId.of('ws_1'),
          UserId.of('user_1'),
          null,
          ConfigurationChange.created(ACME, BY),
        ),
      ]);
    });

    it('refuses a change made against another version', () => {
      expect(() => kept(3).assertVersion(2)).toThrow(
        WorkspaceVersionConflictError,
      );
    });

    it('takes a new name, and says so', () => {
      const renamed = kept().redefinedAs(
        { name: WorkspaceName.of('Acme'), slug: WorkspaceSlug.of('acme-inc') },
        BY,
      );

      expect(renamed.name.value).toBe('Acme');
      expect(renamed.pullEvents()).toEqual([
        new WorkspaceRedefined(
          WorkspaceId.of('ws_1'),
          WorkspaceName.of('Acme'),
          ConfigurationChange.updated(ACME, BY),
        ),
      ]);
    });

    it('keeps its slug for its whole life', () => {
      expect(() =>
        kept().redefinedAs(
          { name: WorkspaceName.of('Acme'), slug: WorkspaceSlug.of('acme') },
          BY,
        ),
      ).toThrow(WorkspaceSlugFixedError);
    });

    it('closes only once it has no team, no token, no token trust, no token minted and nothing else', () => {
      expect(() =>
        kept().close([TeamKey.of('core')], [], [], [], Dependents.none(), BY),
      ).toThrow(/It still has: team core/);
      expect(() =>
        kept().close([], [TokenName.of('ci')], [], [], Dependents.none(), BY),
      ).toThrow(/It still has: token ci/);
      expect(() =>
        kept().close(
          [],
          [],
          [TokenTrustKey.of('github-main')],
          [],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: token trust github-main/);
      expect(() =>
        kept().close(
          [],
          [],
          [],
          [TokenTrustKey.of('github-main')],
          Dependents.none(),
          BY,
        ),
      ).toThrow(/It still has: tokens minted through github-main/);
      expect(() =>
        kept().close(
          [],
          [],
          [],
          [],
          Dependents.of(['secret LINEAR_API_KEY']),
          BY,
        ),
      ).toThrow(/It still has: secret LINEAR_API_KEY/);

      const closed = kept().close([], [], [], [], Dependents.none(), BY);

      expect(closed.isClosed).toBe(true);
      expect(closed.pullEvents()).toEqual([
        new WorkspaceClosed(
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
        managesTokenTrusts: permissions.managesTokenTrusts,
        administers: permissions.administers,
      };
    };

    it.each([
      ['owner', true, true],
      ['admin', true, true],
      ['member', false, false],
    ])(
      'lets its %s read and plan, configuring, managing secrets, runners and token trusts, and administering only as an admin',
      (who, configures, administers) => {
        expect(permissionsOf(person(who))).toEqual({
          reads: true,
          plans: true,
          configures,
          managesSecrets: configures,
          managesRunners: configures,
          managesTokenTrusts: configures,
          administers,
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
        managesTokenTrusts: false,
        administers: false,
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
      (scopes, plans, configures, managesSecrets, managesRunners, managesTokenTrusts) => {
        expect(permissionsOf(token(scopes))).toEqual({
          reads: true,
          plans,
          configures,
          managesSecrets,
          managesRunners,
          managesTokenTrusts,
          administers: false,
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
        managesTokenTrusts: false,
        administers: false,
      });
    });

    it('clears nothing once it has closed', () => {
      expect(
        acme
          .close([], [], [], [], Dependents.none(), BY)
          .permissionsFor(person('owner')).reads,
      ).toBe(false);
    });
  });
});
