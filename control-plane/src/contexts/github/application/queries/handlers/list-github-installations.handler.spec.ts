import type { ReachableInstallationsPort } from '@github/application/ports/reachable-installations.port';
import { ListGitHubInstallationsHandler } from '@github/application/queries/handlers/list-github-installations.handler';
import { ListGitHubInstallationsQuery } from '@github/application/queries/list-github-installations.query';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type {
  WorkspaceDetail,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it, vi } from 'vitest';

const listing = (over: { member?: boolean } = {}) => {
  const installations = {
    of: vi.fn(async () => [
      { installation: GitHubInstallation.of('42'), account: 'acme' },
      { installation: GitHubInstallation.of('7'), account: 'leon' },
    ]),
  } satisfies ReachableInstallationsPort;

  const handler = new ListGitHubInstallationsHandler(
    partial<WorkspaceReaderPort>({
      findForMember: vi.fn(async () =>
        over.member === false ? null : partial<WorkspaceDetail>({ id: 'ws_1' }),
      ),
    }),
    installations,
  );

  return {
    installations,
    list: () =>
      handler.execute(new ListGitHubInstallationsQuery('acme', 'user_1')),
  };
};

describe('ListGitHubInstallationsHandler', () => {
  it('lists the installations the caller can reach on GitHub', async () => {
    const { list, installations } = listing();

    await expect(list()).resolves.toEqual([
      { id: '42', account: 'acme' },
      { id: '7', account: 'leon' },
    ]);
    expect(installations.of).toHaveBeenCalledWith(UserId.of('user_1'));
  });

  it('answers with nothing and asks GitHub nothing where the workspace is not the caller’s', async () => {
    const { list, installations } = listing({ member: false });

    await expect(list()).resolves.toBeNull();
    expect(installations.of).not.toHaveBeenCalled();
  });
});
