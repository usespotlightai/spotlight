import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { WatchedWorkspacesHandler } from '@identity/application/queries/handlers/watched-workspaces.handler';
import { WatchedWorkspacesQuery } from '@identity/application/queries/watched-workspaces.query';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('WatchedWorkspacesHandler', () => {
  it('watches only the workspaces the person may view, checked in one lookup', async () => {
    const workspaces = partial<WorkspaceReaderPort>({
      listForMember: () =>
        Promise.resolve([
          {
            id: 'ws_1',
            name: 'Acme',
            slug: 'acme',
            avatarDigest: null,
            role: 'member',
          },
          {
            id: 'ws_2',
            name: 'Gone',
            slug: 'gone',
            avatarDigest: null,
            role: 'member',
          },
        ]),
    });
    const asked: string[][] = [];
    const access = partial<WorkspaceAccessPort>({
      viewableOf: (_viewer: UserId, ids: readonly WorkspaceId[]) => {
        asked.push(ids.map((each) => each.value));
        return Promise.resolve(ids.filter((each) => each.value === 'ws_1'));
      },
    });

    expect(
      await new WatchedWorkspacesHandler(workspaces, access).execute(
        new WatchedWorkspacesQuery('user_1'),
      ),
    ).toEqual(['ws_1']);
    expect(asked).toEqual([['ws_1', 'ws_2']]);
  });
});
