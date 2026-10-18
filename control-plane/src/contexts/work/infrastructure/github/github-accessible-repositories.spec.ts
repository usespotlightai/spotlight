import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { InstallationRepositoriesPort } from '@github/application/ports/installation-repositories.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GitHubAccessibleRepositories } from '@work/infrastructure/github/github-accessible-repositories';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const accessible = (listed: () => Promise<{ fullName: string }[]>) =>
  new GitHubAccessibleRepositories({
    list: vi.fn(listed),
  } as unknown as InstallationRepositoriesPort);

describe('GitHubAccessibleRepositories', () => {
  it('can access a repository the GitHub App lists', async () => {
    const repositories = accessible(async () => [{ fullName: 'acme/infra' }]);

    await expect(
      repositories.isAccessible(WORKSPACE, Repository.of('acme/infra')),
    ).resolves.toBe(true);
  });

  it('cannot access a repository the GitHub App leaves out', async () => {
    const repositories = accessible(async () => [{ fullName: 'acme/infra' }]);

    await expect(
      repositories.isAccessible(WORKSPACE, Repository.of('acme/example')),
    ).resolves.toBe(false);
  });

  it('can access nothing where the workspace has no GitHub App', async () => {
    const repositories = accessible(async () => {
      throw new NoGitHubInstallationError();
    });

    await expect(
      repositories.isAccessible(WORKSPACE, Repository.of('acme/infra')),
    ).resolves.toBe(false);
  });

  it('lets any other failure through', async () => {
    const repositories = accessible(async () => {
      throw new Error('GitHub is down');
    });

    await expect(
      repositories.isAccessible(WORKSPACE, Repository.of('acme/infra')),
    ).rejects.toThrow('GitHub is down');
  });
});
