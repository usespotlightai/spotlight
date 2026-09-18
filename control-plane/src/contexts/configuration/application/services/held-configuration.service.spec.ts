import { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TARGET = {
  workspaceId: WorkspaceId.of('ws_1'),
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
