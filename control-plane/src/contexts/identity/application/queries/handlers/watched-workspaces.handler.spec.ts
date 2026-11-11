import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { WatchedWorkspacesHandler } from '@identity/application/queries/handlers/watched-workspaces.handler';
import { WatchedWorkspacesQuery } from '@identity/application/queries/watched-workspaces.query';
import { describe, expect, it } from 'vitest';

describe('WatchedWorkspacesHandler', () => {
  it('watches only the workspaces the person may view, checked in one lookup', async () => {
    const workspaces = {
      listForMember: async () => [
        { id: 'ws_1', name: 'Acme', slug: 'acme', role: 'member' },
        { id: 'ws_2', name: 'Gone', slug: 'gone', role: 'member' },
      ],
    } as unknown as WorkspaceReaderPort;
    const asked: string[][] = [];
    const access = {
      viewableOf: async (_viewer: unknown, ids: { value: string }[]) => {
        asked.push(ids.map((each) => each.value));
        return ids.filter((each) => each.value === 'ws_1');
      },
    } as unknown as WorkspaceAccessPort;

    expect(
      await new WatchedWorkspacesHandler(workspaces, access).execute(
        new WatchedWorkspacesQuery('user_1'),
      ),
    ).toEqual(['ws_1']);
    expect(asked).toEqual([['ws_1', 'ws_2']]);
  });
});
