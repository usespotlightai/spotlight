import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type {
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import { ListDirectoryMembersHandler } from '@identity/application/queries/handlers/list-directory-members.handler';
import { ListDirectoryMembersQuery } from '@identity/application/queries/list-directory-members.query';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ACME: DirectoryWorkspace = {
  id: 'ws_1',
  slug: 'acme',
  name: 'Acme',
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  memberCount: 1,
};

const listing = (found: DirectoryWorkspace | null) => {
  const directory: WorkspaceDirectoryPort = {
    list: vi.fn(),
    find: vi.fn().mockResolvedValue(found),
  };
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
    handler: new ListDirectoryMembersHandler(directory, members),
    members,
  };
};

describe('ListDirectoryMembersHandler', () => {
  it('lists everyone in the workspace with their role', async () => {
    const { handler, members } = listing(ACME);

    await expect(
      handler.execute(new ListDirectoryMembersQuery('ws_1')),
    ).resolves.toEqual([
      {
        userId: 'user_1',
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
    const { handler, members } = listing(null);

    await expect(
      handler.execute(new ListDirectoryMembersQuery('ws_gone')),
    ).resolves.toBeNull();
    expect(members.listForWorkspace).not.toHaveBeenCalled();
  });
});
