import type {
  WorkspaceDetail,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { GetWorkspaceHandler } from '@identity/application/queries/handlers/get-workspace.handler';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const acme: WorkspaceDetail = {
  id: 'ws_1',
  name: 'Acme Inc.',
  slug: 'acme-inc',
  avatarDigest: null,
  teams: [{ id: 'team_1', name: 'Acme Inc.', avatarDigest: null }],
  role: 'owner',
  setupStatus: 'done',
};

const reader = (found: WorkspaceDetail | null): WorkspaceReaderPort => ({
  listForMember: vi.fn().mockResolvedValue([]),
  idForSlug: vi.fn().mockResolvedValue(found?.id ?? null),
  slugOf: vi.fn(),
  profileOf: vi.fn(),
  isOpen: vi.fn(),
  identifyTeam: vi.fn(),
  findTeamForViewer: vi.fn(),
  findForMember: vi.fn().mockResolvedValue(found),
});

describe('GetWorkspaceHandler', () => {
  it('returns the workspace with its teams', async () => {
    await expect(
      new GetWorkspaceHandler(reader(acme)).execute(
        new GetWorkspaceQuery('acme-inc', 'user_1'),
      ),
    ).resolves.toEqual(acme);
  });

  it('says whether Spotlight still creates the first team of the workspace', async () => {
    await expect(
      new GetWorkspaceHandler(
        reader({ ...acme, setupStatus: 'pending' }),
      ).execute(new GetWorkspaceQuery('acme-inc', 'user_1')),
    ).resolves.toMatchObject({ setupStatus: 'pending' });
  });

  it('reads only workspaces the viewer belongs to', async () => {
    const workspaces = reader(acme);

    await new GetWorkspaceHandler(workspaces).execute(
      new GetWorkspaceQuery('acme-inc', 'user_1'),
    );

    expect(workspaces.findForMember).toHaveBeenCalledWith(
      'acme-inc',
      UserId.of('user_1'),
    );
  });

  it('reads as absent when the reader finds nothing for them', async () => {
    await expect(
      new GetWorkspaceHandler(reader(null)).execute(
        new GetWorkspaceQuery('someone-elses', 'user_1'),
      ),
    ).resolves.toBeNull();
  });

  it('rejects an unusable slug rather than querying the database', async () => {
    const workspaces = reader(null);

    await expect(
      new GetWorkspaceHandler(workspaces).execute(
        new GetWorkspaceQuery('not a slug', 'user_1'),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
    expect(workspaces.findForMember).not.toHaveBeenCalled();
  });
});
