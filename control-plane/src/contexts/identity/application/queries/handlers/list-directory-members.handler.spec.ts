import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { ListDirectoryMembersHandler } from '@identity/application/queries/handlers/list-directory-members.handler';
import { ListDirectoryMembersQuery } from '@identity/application/queries/list-directory-members.query';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const listing = (open: boolean) => {
  const workspaces = {
    isOpen: vi.fn().mockResolvedValue(open),
  } as unknown as WorkspaceReaderPort;
  const members: MemberReaderPort = {
    listForTeam: vi.fn(),
    listForWorkspace: vi.fn().mockResolvedValue([
      {
        id: 'user_1',
        name: 'Ada Lovelace',
        image: null,
        email: 'ada@example.com',
        role: 'owner',
        teams: [{ id: 'team_1', name: 'Core' }],
        joinedAt: new Date('2026-09-02T00:00:00.000Z'),
      },
    ]),
  };

  return {
    handler: new ListDirectoryMembersHandler(workspaces, members),
    members,
  };
};

describe('ListDirectoryMembersHandler', () => {
  it('lists everyone in the workspace with their role', async () => {
    const { handler, members } = listing(true);

    await expect(
      handler.execute(new ListDirectoryMembersQuery('ws_1')),
    ).resolves.toEqual([
      {
        id: 'user_1',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        role: 'owner',
        joinedAt: '2026-09-02T00:00:00.000Z',
      },
    ]);
    expect(members.listForWorkspace).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
    );
  });

  it('finds no workspace that does not exist', async () => {
    const { handler, members } = listing(false);

    await expect(
      handler.execute(new ListDirectoryMembersQuery('ws_gone')),
    ).resolves.toBeNull();
    expect(members.listForWorkspace).not.toHaveBeenCalled();
  });
});
