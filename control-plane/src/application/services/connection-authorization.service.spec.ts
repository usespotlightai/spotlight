import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import type { WorkspaceRole } from '@domain/value-objects/workspace-role';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it, vi } from 'vitest';

const acme = (role: WorkspaceRole = 'owner', user = 'user_1') =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members:
      role === 'owner'
        ? [{ userId: UserId.of(user), role: 'owner' }]
        : [
            { userId: UserId.of('owner_1'), role: 'owner' },
            { userId: UserId.of(user), role },
          ],
    teams: [],
  });

const asking = (
  over: { workspace?: Workspace | null; member?: boolean } = {},
) =>
  new ConnectionAuthorization(
    {
      findTeamForMember: vi.fn(async () =>
        over.member === false
          ? null
          : {
              workspaceId: 'ws_1',
              teamId: 'team_1',
              teamKey: 'platform',
              slug: 'acme',
            },
      ),
    } as unknown as WorkspaceReaderPort,
    {
      findBySlug: vi.fn(async () =>
        over.workspace === undefined ? acme() : over.workspace,
      ),
    } as unknown as WorkspaceRepository,
  );

describe('ConnectionAuthorization', () => {
  it('hands an owner the workspace to act on', async () => {
    const workspace = await asking().connectableBy('team_1', 'user_1');

    expect(workspace?.slug.value).toBe('acme');
  });

  it('hands an admin the workspace too', async () => {
    const workspace = await asking({ workspace: acme('admin') }).connectableBy(
      'team_1',
      'user_1',
    );

    expect(workspace).not.toBeNull();
  });

  it('refuses a plain member', async () => {
    expect(
      await asking({ workspace: acme('member') }).connectableBy(
        'team_1',
        'user_1',
      ),
    ).toBeNull();
  });

  it('refuses someone who is not on the team at all', async () => {
    expect(
      await asking({ member: false }).connectableBy('team_1', 'user_1'),
    ).toBeNull();
  });

  it('refuses where the workspace cannot be found', async () => {
    expect(
      await asking({ workspace: null }).connectableBy('team_1', 'user_1'),
    ).toBeNull();
  });
});
