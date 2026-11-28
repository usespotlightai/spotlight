import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import type { ReachableInstallationsPort } from '@github/application/ports/reachable-installations.port';
import { ListGitHubInstallationsHandler } from '@github/application/queries/handlers/list-github-installations.handler';
import { ListGitHubInstallationsQuery } from '@github/application/queries/list-github-installations.query';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type {
  WorkspaceDetail,
  WorkspaceProfile,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const listing = (
  over: {
    member?: boolean;
    holders?: Record<string, string>;
    seen?: Record<string, string>;
  } = {},
) => {
  const installations = {
    of: vi.fn(async () => [
      { installation: GitHubInstallation.of('42'), account: 'acme' },
      { installation: GitHubInstallation.of('7'), account: 'leon' },
    ]),
  } satisfies ReachableInstallationsPort;
  const viewableOf = vi.fn(
    async (_viewer: UserId, ids: readonly WorkspaceId[]) =>
      ids.filter((each) => over.seen?.[each.value] !== undefined),
  );

  const handler = new ListGitHubInstallationsHandler(
    partial<WorkspaceReaderPort>({
      findForMember: vi.fn(async () =>
        over.member === false ? null : partial<WorkspaceDetail>({ id: 'ws_1' }),
      ),
      profileOf: vi.fn(async (id: WorkspaceId) =>
        partial<WorkspaceProfile>({
          id: id.value,
          name: over.seen?.[id.value] ?? '',
        }),
      ),
    }),
    partial<WorkspaceAccessPort>({ viewableOf }),
    installations,
    {
      installationOf: vi.fn(),
      connectionsOf: vi.fn(async (asked: readonly GitHubInstallation[]) =>
        asked.flatMap((installation) => {
          const holder = over.holders?.[installation.value];

          return holder === undefined
            ? []
            : [{ installation, workspaceId: WorkspaceId.of(holder) }];
        }),
      ),
    } satisfies GitHubConnectionReaderPort,
  );

  return {
    installations,
    viewableOf,
    list: () =>
      handler.execute(new ListGitHubInstallationsQuery('acme', 'user_1')),
  };
};

describe('ListGitHubInstallationsHandler', () => {
  it('lists the installations the caller can reach on GitHub', async () => {
    const { list, installations, viewableOf } = listing();

    await expect(list()).resolves.toEqual([
      { id: '42', account: 'acme', usedElsewhere: false, usedBy: null },
      { id: '7', account: 'leon', usedElsewhere: false, usedBy: null },
    ]);
    expect(installations.of).toHaveBeenCalledWith(UserId.of('user_1'));
    expect(viewableOf).not.toHaveBeenCalled();
  });

  it('marks an installation another workspace uses, and names that workspace where the caller is of it', async () => {
    const { list, viewableOf } = listing({
      holders: { '42': 'ws_2' },
      seen: { ws_1: 'Evidence Labs', ws_2: 'Tidepool Labs' },
    });

    await expect(list()).resolves.toEqual([
      {
        id: '42',
        account: 'acme',
        usedElsewhere: true,
        usedBy: 'Tidepool Labs',
      },
      { id: '7', account: 'leon', usedElsewhere: false, usedBy: null },
    ]);
    expect(viewableOf).toHaveBeenCalledWith(UserId.of('user_1'), [
      WorkspaceId.of('ws_2'),
    ]);
  });

  it('marks an installation a workspace the caller can’t see uses, without naming it', async () => {
    const { list } = listing({
      holders: { '42': 'ws_9' },
      seen: { ws_1: 'Evidence Labs' },
    });

    await expect(list()).resolves.toContainEqual({
      id: '42',
      account: 'acme',
      usedElsewhere: true,
      usedBy: null,
    });
  });

  it('leaves an installation this workspace already uses free to take', async () => {
    const { list, viewableOf } = listing({ holders: { '7': 'ws_1' } });

    await expect(list()).resolves.toContainEqual({
      id: '7',
      account: 'leon',
      usedElsewhere: false,
      usedBy: null,
    });
    expect(viewableOf).not.toHaveBeenCalled();
  });

  it('answers with nothing and asks GitHub nothing where the workspace is not the caller’s', async () => {
    const { list, installations } = listing({ member: false });

    await expect(list()).resolves.toBeNull();
    expect(installations.of).not.toHaveBeenCalled();
  });
});
