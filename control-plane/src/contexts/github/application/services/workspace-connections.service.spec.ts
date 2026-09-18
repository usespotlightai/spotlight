import { WorkspaceConnections } from '@github/application/services/workspace-connections.service';
import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const INSTALLED = GitHubInstallation.of('158876513');

const connections = (held: boolean) =>
  new WorkspaceConnections({
    claimantOf: vi.fn(async () => (held ? WORKSPACE : null)),
    of: vi.fn(async (id: WorkspaceId) =>
      held
        ? GitHubConnection.rehydrate({
            workspaceId: id,
            installation: INSTALLED,
            version: 1,
          })
        : GitHubConnection.none(id),
    ),
    save: vi.fn(async (_: GitHubConnection) => {}),
  } satisfies GitHubConnectionRepository);

describe('WorkspaceConnections', () => {
  it('says whether a workspace is connected', async () => {
    expect(await connections(true).isConnected(WORKSPACE)).toBe(true);
    expect(await connections(false).isConnected(WORKSPACE)).toBe(false);
  });
});
