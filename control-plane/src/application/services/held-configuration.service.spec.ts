import type { RepositoryContentsPort } from '@application/ports/repository-contents.port';
import { HeldConfiguration } from '@application/services/held-configuration.service';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { describe, expect, it, vi } from 'vitest';

const TARGET = {
  installation: GitHubInstallation.of('42'),
  repository: Repository.of('acme/api'),
};

const CONFIG = {
  path: '.spotlight/lines/delivery/line.yml',
  text: 'version: 1',
};

const holding = (
  over: { head?: string | null; files?: { path: string; text: string }[] } = {},
) => {
  const contents = {
    headOf: vi.fn(async () =>
      over.head === undefined ? 'a1b2c3d' : over.head,
    ),
    under: vi.fn(async () => over.files ?? [CONFIG]),
    read: vi.fn(async () => null),
  } as unknown as RepositoryContentsPort;

  return { contents, service: new HeldConfiguration(contents) };
};

describe('HeldConfiguration', () => {
  it('reads what is kept under the configuration directory at the head', async () => {
    const { service, contents } = holding();

    const held = await service.at(TARGET);

    expect(held?.repository).toEqual(TARGET.repository);
    expect(held?.sha).toBe('a1b2c3d');
    expect(held?.files.map((each) => each.path)).toEqual([CONFIG.path]);
    expect(contents.under).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'a1b2c3d', path: '.spotlight' }),
    );
  });

  it('holds nothing where the repository has no configuration', async () => {
    const { service } = holding({ files: [] });

    expect((await service.at(TARGET))?.files).toEqual([]);
  });

  it('is nothing where the repository has no branch to read at', async () => {
    const { service, contents } = holding({ head: null });

    expect(await service.at(TARGET)).toBeNull();
    expect(contents.under).not.toHaveBeenCalled();
  });
});
