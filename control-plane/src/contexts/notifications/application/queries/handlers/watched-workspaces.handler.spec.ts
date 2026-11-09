import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { WatchedWorkspacesHandler } from '@notifications/application/queries/handlers/watched-workspaces.handler';
import { WatchedWorkspacesQuery } from '@notifications/application/queries/watched-workspaces.query';
import { describe, expect, it } from 'vitest';

describe('WatchedWorkspacesHandler', () => {
  it('watches only the workspaces the person may view', async () => {
    const workspaces = {
      listForMember: async () => [
        { id: 'ws_1', name: 'Acme', slug: 'acme', role: 'member' },
        { id: 'ws_2', name: 'Gone', slug: 'gone', role: 'member' },
      ],
    } as unknown as WorkspaceReaderPort;
    const access = {
      mayView: async (_viewer: unknown, workspace: { value: string }) =>
        workspace.value === 'ws_1',
    } as unknown as WorkspaceAccessPort;

    expect(
      await new WatchedWorkspacesHandler(workspaces, access).execute(
        new WatchedWorkspacesQuery('user_1'),
      ),
    ).toEqual(['ws_1']);
  });
});
