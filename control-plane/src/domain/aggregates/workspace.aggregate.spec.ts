import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { TeamCreated } from '@domain/events/team-created.event';
import { NotYoursToConnectError } from '@domain/exceptions/not-yours-to-connect.error';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const build = (id = 'ws_1') => {
  let next = 0;
  return Workspace.create({
    id: WorkspaceId.of(id),
    name: WorkspaceName.of('Acme Inc.'),
    slug: WorkspaceSlug.of('acme-inc'),
    owner: UserId.of('user_1'),
    newId: () => `id_${++next}`,
  });
};

describe('Workspace', () => {
  it('starts with its creator as the sole owner', () => {
    expect(build().members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
    ]);
  });

  it('is never without a team, and names the first after itself', () => {
    const [first, ...rest] = build().teams;

    expect(rest).toHaveLength(0);
    expect(first.name.value).toBe('Acme Inc.');
    expect(first.members).toEqual([
      { userId: UserId.of('user_1'), role: 'owner' },
    ]);
  });

  it('asks for a factory rather than building one itself', () => {
    const workspace = build();
    const [raised, ...rest] = workspace.happened;

    expect(rest).toHaveLength(0);
    expect(raised).toBeInstanceOf(TeamCreated);
    expect((raised as TeamCreated).teamId).toEqual(workspace.teams[0]?.id);
  });

  it('holds what it raised however often it is read', () => {
    const workspace = build();

    expect(workspace.happened).toHaveLength(1);
    expect(workspace.happened).toHaveLength(1);
  });

  it('is the same workspace as another holding its identity', () => {
    expect(build().equals(build())).toBe(true);
    expect(build().equals(build('ws_2'))).toBe(false);
  });

  it('reaches no GitHub until somebody connects it', () => {
    expect(build().githubInstallation).toBeNull();
  });

  describe('connecting to GitHub', () => {
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
        teams: [],
      });

    it('says what a person is here, and nothing of one who is not', () => {
      const workspace = withMember('member');

      expect(workspace.roleOf(OWNER)).toBe('owner');
      expect(workspace.roleOf(UserId.of('user_2'))).toBe('member');
      expect(workspace.roleOf(UserId.of('stranger'))).toBeNull();
      expect(workspace.holds(UserId.of('stranger'))).toBe(false);
    });

    it('takes the installation an owner connects it to', () => {
      const connected = build().connectedTo(GitHubInstallation.of('42'), OWNER);

      expect(connected.githubInstallation).toEqual(GitHubInstallation.of('42'));
    });

    // An App uninstalled and put back on is a new installation, and the old
    // number opens nothing.
    it('takes a second installation over the first', () => {
      const connected = build()
        .connectedTo(GitHubInstallation.of('42'), OWNER)
        .connectedTo(GitHubInstallation.of('43'), OWNER);

      expect(connected.githubInstallation).toEqual(GitHubInstallation.of('43'));
    });

    it('leaves the workspace it was asked of unchanged', () => {
      const workspace = build();
      workspace.connectedTo(GitHubInstallation.of('42'), OWNER);

      expect(workspace.githubInstallation).toBeNull();
    });

    it('lets an admin connect it', () => {
      expect(
        withMember('admin').connectedTo(
          GitHubInstallation.of('42'),
          UserId.of('user_2'),
        ).githubInstallation,
      ).toEqual(GitHubInstallation.of('42'));
    });

    // Connecting changes how every run in the workspace reaches out.
    it('refuses a member who is neither owner nor admin', () => {
      expect(() =>
        withMember('member').connectedTo(
          GitHubInstallation.of('42'),
          UserId.of('user_2'),
        ),
      ).toThrow(NotYoursToConnectError);
    });

    it('refuses somebody who is not of it at all', () => {
      expect(() =>
        build().connectedTo(GitHubInstallation.of('42'), UserId.of('stranger')),
      ).toThrow(NotYoursToConnectError);
    });
  });
});
