import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { LastOwnerError } from '@domain/exceptions/last-owner.error';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import { NotYoursToGiveError } from '@domain/exceptions/not-yours-to-give.error';
import { Connection } from '@domain/value-objects/connection.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const GITHUB = Connection.of('github', '42');
const REINSTALLED = Connection.of('github', '43');

const FIRST_TEAM = TeamId.of('team_1');

const build = (id = 'ws_1') =>
  Workspace.open({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    firstTeam: FIRST_TEAM,
  });

describe('Workspace', () => {
  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      { userId: UserId.of('user_1'), role: WorkspaceRole.owner },
    ]);
  });

  it('opens with the team it was made alongside', () => {
    expect(build().teams).toEqual([FIRST_TEAM]);
    expect(build().holdsTeam(FIRST_TEAM)).toBe(true);
    expect(build().holdsTeam(TeamId.of('team_2'))).toBe(false);
  });

  it('is the same workspace as another holding its identity', () => {
    expect(build().equals(build())).toBe(true);
    expect(build().equals(build('ws_2'))).toBe(false);
  });

  it('reaches no host until somebody connects it', () => {
    expect(build().connections).toEqual([]);
    expect(build().connectionTo('github')).toBeNull();
  });

  describe('connecting to a host', () => {
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
        teams: [FIRST_TEAM],
      });

    it('says what a person is here, and nothing of one who is not', () => {
      const workspace = withMember(WorkspaceRole.member);

      expect(workspace.roleOf(OWNER)).toBe(WorkspaceRole.owner);
      expect(workspace.roleOf(UserId.of('user_2'))).toBe(WorkspaceRole.member);
      expect(workspace.roleOf(UserId.of('stranger'))).toBeNull();
      expect(workspace.holds(UserId.of('stranger'))).toBe(false);
    });

    it('takes the connection an owner connects it to', () => {
      expect(build().connectedTo(GITHUB, OWNER).connectionTo('github')).toEqual(
        GITHUB,
      );
    });

    // An App uninstalled and put back on is a new installation, and the old
    // number opens nothing.
    it('takes a second connection to one host over the first', () => {
      const connected = build()
        .connectedTo(GITHUB, OWNER)
        .connectedTo(REINSTALLED, OWNER);

      expect(connected.connections).toEqual([REINSTALLED]);
    });

    // Two hosts are two connections: connecting one says nothing about the
    // other, and a workspace may well reach both.
    it('keeps a connection to another host when one is replaced', () => {
      const elsewhere = Connection.of('linear', 'team_9');
      const connected = build()
        .connectedTo(GITHUB, OWNER)
        .connectedTo(elsewhere, OWNER)
        .connectedTo(REINSTALLED, OWNER);

      expect(connected.connectionTo('linear')).toEqual(elsewhere);
      expect(connected.connectionTo('github')).toEqual(REINSTALLED);
    });

    it('leaves the workspace it was asked of unchanged', () => {
      const workspace = build();
      workspace.connectedTo(GITHUB, OWNER);

      expect(workspace.connections).toEqual([]);
    });

    it('lets an admin connect it', () => {
      expect(
        withMember(WorkspaceRole.admin)
          .connectedTo(GITHUB, UserId.of('user_2'))
          .connectionTo('github'),
      ).toEqual(GITHUB);
    });

    // Connecting changes how every run in the workspace reaches out.
    it('refuses a member who is neither owner nor admin', () => {
      expect(() =>
        withMember(WorkspaceRole.member).connectedTo(
          GITHUB,
          UserId.of('user_2'),
        ),
      ).toThrow(NotYoursToConnectError);
    });

    it('refuses somebody who is not of it at all', () => {
      expect(() => build().connectedTo(GITHUB, UserId.of('stranger'))).toThrow(
        NotYoursToConnectError,
      );
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
      const joined = build().joinedBy(ADA, WorkspaceRole.member);

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

  describe('letting a host go', () => {
    const connected = () =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
        teams: [],
        connections: [Connection.of('github', '158876513')],
      });

    it('drops what it held for that host', () => {
      expect(
        connected().disconnectedFrom('github').connectionTo('github'),
      ).toBeNull();
    });

    // Removed on GitHub is removed, whoever did the removing.
    it('asks nobody for permission', () => {
      expect(() => connected().disconnectedFrom('github')).not.toThrow();
    });

    it('leaves a workspace that held nothing for it alone', () => {
      const workspace = connected();

      expect(workspace.disconnectedFrom('linear')).toBe(workspace);
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
        teams: [],
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
      ).toThrow(/nobody hands out a rank they do not hold/);
    });

    it('refuses an admin reaching another admin', () => {
      const two = staffed(
        { id: OWNER, role: WorkspaceRole.owner },
        { id: ADMIN, role: WorkspaceRole.admin },
        { id: MEMBER, role: WorkspaceRole.admin },
      );

      expect(() =>
        two.roleChangedTo(MEMBER, WorkspaceRole.member, ADMIN),
      ).toThrow(/not below you/);
    });

    it('refuses an admin changing their own', () => {
      expect(() =>
        staff().roleChangedTo(ADMIN, WorkspaceRole.member, ADMIN),
      ).toThrow(/your own is not yours to change/);
    });

    it('refuses a plain member setting anybody’s', () => {
      expect(() =>
        staff().roleChangedTo(ADMIN, WorkspaceRole.member, MEMBER),
      ).toThrow(/only an owner or an admin/);
    });

    it('refuses somebody who is not of the workspace at all', () => {
      expect(() =>
        staff().roleChangedTo(
          MEMBER,
          WorkspaceRole.admin,
          UserId.of('stranger'),
        ),
      ).toThrow(/only an owner or an admin/);
    });

    it('refuses a role for somebody who is not of the workspace', () => {
      expect(() =>
        staff().roleChangedTo(
          UserId.of('stranger'),
          WorkspaceRole.admin,
          OWNER,
        ),
      ).toThrow(/not of this workspace/);
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
});
