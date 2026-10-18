import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { ConnectForbiddenError } from '@github/domain/exceptions/connect-forbidden.error';
import { InstallationAlreadyConnectedError } from '@github/domain/exceptions/installation-already-connected.error';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const ELSEWHERE = WorkspaceId.of('ws_2');
const INSTALLED = GitHubInstallation.of('42');
const REINSTALLED = GitHubInstallation.of('43');

const allowed = {
  isWorkspaceAdmin: true,
  isInstallationAdmin: true,
  connectedWorkspace: null,
};

const none = () => GitHubConnection.none(WORKSPACE);

const connected = () =>
  GitHubConnection.rehydrate({
    workspaceId: WORKSPACE,
    installation: INSTALLED,
    version: 3,
  });

describe('GitHubConnection', () => {
  it('has no installation until somebody connects one', () => {
    expect(none().installation).toBeNull();
    expect(none().isConnected).toBe(false);
  });

  it('takes the installation it is connected to, and says so', () => {
    const after = none().connectTo(INSTALLED, allowed);

    expect(after.installation).toEqual(INSTALLED);
    expect(after.pullEvents()).toEqual([
      new WorkspaceConnected(WORKSPACE, INSTALLED),
    ]);
  });

  it('takes a second installation over the first', () => {
    expect(connected().connectTo(REINSTALLED, allowed).installation).toEqual(
      REINSTALLED,
    );
  });

  it('keeps the version it was read at, for the repository to check', () => {
    expect(connected().connectTo(REINSTALLED, allowed).version).toBe(3);
  });

  it('leaves the connection it was queried for unchanged', () => {
    const connection = none();
    connection.connectTo(INSTALLED, allowed);

    expect(connection.installation).toBeNull();
  });

  it('denies somebody who is not an admin of the workspace', () => {
    expect(() =>
      none().connectTo(INSTALLED, {
        ...allowed,
        isWorkspaceAdmin: false,
      }),
    ).toThrow(ConnectForbiddenError);
  });

  it('denies an installation when the caller is not its admin on GitHub', () => {
    expect(() =>
      none().connectTo(INSTALLED, {
        ...allowed,
        isInstallationAdmin: false,
      }),
    ).toThrow(ConnectForbiddenError);
  });

  it('denies an installation another workspace already has', () => {
    expect(() =>
      none().connectTo(INSTALLED, {
        ...allowed,
        connectedWorkspace: ELSEWHERE,
      }),
    ).toThrow(InstallationAlreadyConnectedError);
  });

  it('takes again an installation it already has itself', () => {
    expect(
      connected().connectTo(INSTALLED, {
        ...allowed,
        connectedWorkspace: WORKSPACE,
      }).installation,
    ).toEqual(INSTALLED);
  });

  it('does not read back a connection that was never written', () => {
    expect(() =>
      GitHubConnection.rehydrate({
        workspaceId: WORKSPACE,
        installation: INSTALLED,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });

  describe('letting an installation go', () => {
    it('drops the installation, and says so', () => {
      const after = connected().disconnectFrom(INSTALLED);

      expect(after.installation).toBeNull();
      expect(after.pullEvents()).toEqual([
        new WorkspaceDisconnected(WORKSPACE, INSTALLED),
      ]);
    });

    it('leaves a connection to another installation alone', () => {
      const connection = connected();

      expect(connection.disconnectFrom(REINSTALLED)).toBe(connection);
    });

    it('says nothing where it had nothing', () => {
      const connection = none();

      expect(connection.disconnectFrom(INSTALLED)).toBe(connection);
      expect(connection.pullEvents()).toEqual([]);
    });
  });
});
