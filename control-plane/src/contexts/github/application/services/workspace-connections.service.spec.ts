import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import { WorkspaceConnections } from '@github/application/services/workspace-connections.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLED = GitHubInstallation.of('158876513');

const connections = (connected: boolean, saved: GitHubConnection[] = []) =>
  new WorkspaceConnections(
    {
      connectedWorkspaceOf: vi.fn(async () => (connected ? WORKSPACE : null)),
      lockedConnectedWorkspaceOf: vi.fn(async () =>
        connected ? WORKSPACE : null,
      ),
      of: vi.fn(async (id: WorkspaceId) =>
        connected
          ? GitHubConnection.rehydrate({
              workspaceId: id,
              installation: INSTALLED,
              version: 1,
            })
          : GitHubConnection.none(id),
      ),
      save: vi.fn(async (connection: GitHubConnection) => {
        saved.push(connection);
      }),
    } satisfies GitHubConnectionRepository,
    {
      installationOf: vi.fn(async () => (connected ? INSTALLED : null)),
    } satisfies GitHubConnectionReaderPort,
  );

describe('WorkspaceConnections', () => {
  it('says whether a workspace is connected', async () => {
    expect(await connections(true).isConnected(WORKSPACE)).toBe(true);
    expect(await connections(false).isConnected(WORKSPACE)).toBe(false);
  });

  it('lets go of the installation of a deleted workspace, and says so', async () => {
    const saved: GitHubConnection[] = [];

    await connections(true, saved).workspaceDeleted(WORKSPACE);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.isConnected).toBe(false);
    expect(saved[0]?.pullEvents().map((each) => each.kind)).toEqual([
      'workspace.disconnected',
    ]);
  });

  it('changes nothing for a deleted workspace that was not connected', async () => {
    const saved: GitHubConnection[] = [];

    await connections(false, saved).workspaceDeleted(WORKSPACE);

    expect(saved).toEqual([]);
  });
});
