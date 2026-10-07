import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import { WorkspaceRedefined } from '@identity/domain/events/workspace-redefined.event';
import { LastOwnerError } from '@identity/domain/exceptions/last-owner.error';
import { NotYoursToGiveError } from '@identity/domain/exceptions/not-yours-to-give.error';
import { WorkspaceMovedOnError } from '@identity/domain/exceptions/workspace-moved-on.error';
import { WorkspaceSlugFixedError } from '@identity/domain/exceptions/workspace-slug-fixed.error';
import { Holdings } from '@identity/domain/value-objects/holdings.vo';
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

  it('says it opened, naming the first team it should hold', () => {
    expect(build().pullEvents()).toEqual([
      new WorkspaceOpened(
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        FIRST_TEAM,
        ConfigurationChange.created(ACME, BY),
      ),
    ]);
  });

  it('is the same workspace as another holding its identity', () => {
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
      expect(workspace.holds(UserId.of('stranger'))).toBe(false);
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

    it('holds everybody of it, and nobody outside it', () => {
      expect(workspace.holds(MEMBER)).toBe(true);
      expect(workspace.holds(STRANGER)).toBe(false);
    });
  });

  describe('somebody joining', () => {
    const ADA = UserId.of('user_ada');

    it('puts them on the roster at what they were offered', () => {
      const joined = build().joinedBy(ADA, WorkspaceRole.member);

      expect(joined.roleOf(ADA)).toBe(WorkspaceRole.member);
      expect(joined.holds(ADA)).toBe(true);
    });

    it('says so', () => {
      const opened = build();
      opened.pullEvents();
      const joined = opened.joinedBy(ADA, WorkspaceRole.member);

      expect(joined.pullEvents()).toMatchObject([
        { kind: 'workspace.member-joined', userId: ADA },
      ]);
    });

    it('leaves somebody already of it exactly as they were', () => {
      const workspace = build().joinedBy(ADA, WorkspaceRole.admin);

      expect(workspace.joinedBy(ADA, WorkspaceRole.member)).toBe(workspace);
      expect(workspace.roleOf(ADA)).toBe(WorkspaceRole.admin);
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
        staff()
          .roleChangedTo(MEMBER, WorkspaceRole.admin, OWNER)
          .roleOf(MEMBER),
      ).toBe(WorkspaceRole.admin);
    });

    it('lets an owner lower somebody', () => {
      expect(
        staff().roleChangedTo(ADMIN, WorkspaceRole.member, OWNER).roleOf(ADMIN),
      ).toBe(WorkspaceRole.member);
    });

    it('lets an owner unseat another owner', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.owner },
      );

      expect(
        two.roleChangedTo(ADMIN, WorkspaceRole.member, OWNER).roleOf(ADMIN),
      ).toBe(WorkspaceRole.member);
    });

    it('lets an owner step down once somebody else owns it', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.owner },
      );

      expect(
        two.roleChangedTo(OWNER, WorkspaceRole.admin, OWNER).roleOf(OWNER),
      ).toBe(WorkspaceRole.admin);
    });

    it('lets an admin set the role of somebody below them', () => {
      expect(
        staff()
          .roleChangedTo(MEMBER, WorkspaceRole.admin, ADMIN)
          .roleOf(MEMBER),
      ).toBe(WorkspaceRole.admin);
    });

    it('refuses an admin reaching an owner', () => {
      expect(() =>
        staff().roleChangedTo(OWNER, WorkspaceRole.member, ADMIN),
      ).toThrow(NotYoursToGiveError);
    });

    it('refuses an admin handing out a rank they do not hold', () => {
      expect(() =>
        staff().roleChangedTo(MEMBER, WorkspaceRole.owner, ADMIN),
      ).toThrow(/cannot give a role above your own/);
    });

    it('refuses an admin reaching another admin', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.admin },
      );

      expect(() =>
        two.roleChangedTo(MEMBER, WorkspaceRole.member, ADMIN),
      ).toThrow(/people below you/);
    });

    it('refuses an admin changing their own', () => {
      expect(() =>
        staff().roleChangedTo(ADMIN, WorkspaceRole.member, ADMIN),
      ).toThrow(/cannot change your own role/);
    });

    it('refuses a plain member setting anybody’s', () => {
      expect(() =>
        staff().roleChangedTo(ADMIN, WorkspaceRole.member, MEMBER),
      ).toThrow(/Only an owner or an admin/);
    });

    it('refuses somebody who is not of the workspace at all', () => {
      expect(() =>
        staff().roleChangedTo(
          MEMBER,
          WorkspaceRole.admin,
          UserId.of('stranger'),
        ),
      ).toThrow(/Only an owner or an admin/);
    });

    it('refuses a role for somebody who is not of the workspace', () => {
      expect(() =>
        staff().roleChangedTo(
          UserId.of('stranger'),
          WorkspaceRole.admin,
          OWNER,
        ),
      ).toThrow(/not a member of this workspace/);
    });

    it('keeps the last owner, who is all that can put anything right', () => {
      expect(() =>
        staff().roleChangedTo(OWNER, WorkspaceRole.admin, OWNER),
      ).toThrow(LastOwnerError);
    });

    it('is no change where they already stand there', () => {
      const workspace = staff();

      expect(workspace.roleChangedTo(MEMBER, WorkspaceRole.member, ADMIN)).toBe(
        workspace,
      );
    });

    it('says whose standing changed, and from what to what', () => {
      const changed = staff().roleChangedTo(MEMBER, WorkspaceRole.admin, OWNER);

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
        staff().roleChangedTo(MEMBER, WorkspaceRole.member, ADMIN).pullEvents(),
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
      const changed = staff().roleChangedTo(MEMBER, WorkspaceRole.admin, OWNER);

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
      expect(() => kept(3).expecting(2)).toThrow(WorkspaceMovedOnError);
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

    it('closes only once it holds no team, no token, no token trust, no token minted and nothing else', () => {
      expect(() =>
        kept().closed([TeamKey.of('core')], [], [], [], Holdings.none(), BY),
      ).toThrow(/Still holds: team core/);
      expect(() =>
        kept().closed([], [TokenName.of('ci')], [], [], Holdings.none(), BY),
      ).toThrow(/Still holds: token ci/);
      expect(() =>
        kept().closed(
          [],
          [],
          [TokenTrustKey.of('github-main')],
          [],
          Holdings.none(),
          BY,
        ),
      ).toThrow(/Still holds: token trust github-main/);
      expect(() =>
        kept().closed(
          [],
          [],
          [],
          [TokenTrustKey.of('github-main')],
          Holdings.none(),
          BY,
        ),
      ).toThrow(/Still holds: tokens minted through github-main/);
      expect(() =>
        kept().closed(
          [],
          [],
          [],
          [],
          Holdings.of(['secret LINEAR_API_KEY']),
          BY,
        ),
      ).toThrow(/Still holds: secret LINEAR_API_KEY/);

      const closed = kept().closed([], [], [], [], Holdings.none(), BY);

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

  describe('what a principal is cleared to do in it', () => {
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

    const cleared = (principal: PersonPrincipal | TokenPrincipal) => {
      const clearance = acme.clearanceFor(principal);

      return {
        reads: clearance.reads,
        plans: clearance.plans,
        configures: clearance.configures,
        managesSecrets: clearance.managesSecrets,
        managesRunners: clearance.managesRunners,
        managesTokenTrusts: clearance.managesTokenTrusts,
        administers: clearance.administers,
      };
    };

    it.each([
      ['owner', true, true],
      ['admin', true, true],
      ['member', false, false],
    ])(
      'lets its %s read and plan, configuring, managing secrets, runners and token trusts, and administering only as an admin',
      (who, configures, administers) => {
        expect(cleared(person(who))).toEqual({
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
      expect(cleared(person('stranger'))).toEqual({
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
        expect(cleared(token(scopes))).toEqual({
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
      expect(cleared(token(['configure', 'secrets'], 'ws_2'))).toEqual({
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
          .closed([], [], [], [], Holdings.none(), BY)
          .clearanceFor(person('owner')).reads,
      ).toBe(false);
    });
  });
});
