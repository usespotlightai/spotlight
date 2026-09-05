import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import { Connection } from '@domain/value-objects/connection.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const GITHUB = Connection.of('github', '42');
const REINSTALLED = Connection.of('github', '43');

const FIRST_TEAM = TeamId.of('team_1');

const build = (id = 'ws_1') =>
  Workspace.create({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    firstTeam: FIRST_TEAM,
  });

describe('Workspace', () => {
  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
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
          { userId: OWNER, role: 'owner' },
          { userId: UserId.of(user), role },
        ],
        teams: [FIRST_TEAM],
      });

    it('says what a person is here, and nothing of one who is not', () => {
      const workspace = withMember('member');

      expect(workspace.roleOf(OWNER)).toBe('owner');
      expect(workspace.roleOf(UserId.of('user_2'))).toBe('member');
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
        withMember('admin')
          .connectedTo(GITHUB, UserId.of('user_2'))
          .connectionTo('github'),
      ).toEqual(GITHUB);
    });

    // Connecting changes how every run in the workspace reaches out.
    it('refuses a member who is neither owner nor admin', () => {
      expect(() =>
        withMember('member').connectedTo(GITHUB, UserId.of('user_2')),
      ).toThrow(NotYoursToConnectError);
    });

    it('refuses somebody who is not of it at all', () => {
      expect(() => build().connectedTo(GITHUB, UserId.of('stranger'))).toThrow(
        NotYoursToConnectError,
      );
    });
  });

  describe('letting a host go', () => {
    const connected = () =>
      Workspace.rehydrate({
        id: WorkspaceId.of('ws_1'),
        name: WorkspaceName.of('Acme'),
        slug: WorkspaceSlug.of('acme'),
        members: [{ userId: UserId.of('user_1'), role: 'owner' }],
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
});
