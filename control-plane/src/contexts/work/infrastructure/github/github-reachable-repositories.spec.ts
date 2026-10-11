import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { RepositoryCatalogPort } from '@github/application/ports/repository-catalog.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { GitHubReachableRepositories } from '@work/infrastructure/github/github-reachable-repositories';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const reachable = (listed: () => Promise<{ fullName: string }[]>) =>
  new GitHubReachableRepositories({
    list: vi.fn(listed),
  } as unknown as RepositoryCatalogPort);

describe('GitHubReachableRepositories', () => {
  it('reaches a repository the GitHub App lists', async () => {
    const repositories = reachable(async () => [{ fullName: 'acme/infra' }]);

    await expect(
      repositories.reaches(WORKSPACE, Repository.of('acme/infra')),
    ).resolves.toBe(true);
  });

  it('does not reach a repository the GitHub App leaves out', async () => {
    const repositories = reachable(async () => [{ fullName: 'acme/infra' }]);

    await expect(
      repositories.reaches(WORKSPACE, Repository.of('acme/example')),
    ).resolves.toBe(false);
  });

  it('reaches nothing where the workspace has no GitHub App', async () => {
    const repositories = reachable(async () => {
      throw new NoGitHubInstallationError();
    });

    await expect(
      repositories.reaches(WORKSPACE, Repository.of('acme/infra')),
    ).resolves.toBe(false);
  });

  it('lets any other failure through', async () => {
    const repositories = reachable(async () => {
      throw new Error('GitHub is down');
    });

    await expect(
      repositories.reaches(WORKSPACE, Repository.of('acme/infra')),
    ).rejects.toThrow('GitHub is down');
  });
});
