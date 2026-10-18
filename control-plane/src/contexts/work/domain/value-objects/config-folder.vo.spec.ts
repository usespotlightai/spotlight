import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidConfigFolderError } from '@work/domain/exceptions/invalid-config-folder.error';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { describe, expect, it } from 'vitest';

describe('ConfigFolder', () => {
  it('keeps a folder in a repository', () => {
    const home = ConfigFolder.of({
      repository: 'acme/infra',
      folder: 'spotlight',
    });

    expect(home.repository.value).toBe('acme/infra');
    expect(home.folder).toBe('spotlight');
    expect(home.pullRequest).toBeNull();
  });

  it('reads a folder with slashes around it as the folder itself', () => {
    expect(
      ConfigFolder.of({
        repository: 'acme/infra',
        folder: ' /infra/spotlight/ ',
      }).folder,
    ).toBe('infra/spotlight');
  });

  it('rejects a repository that is not owner/name', () => {
    expect(() =>
      ConfigFolder.of({ repository: 'infra', folder: 'spotlight' }),
    ).toThrow(InvalidConfigFolderError);
  });

  it.each(['', '..', 'a/../b', 'with space', 'a\\b'])(
    'rejects the folder %j',
    (folder) => {
      expect(() =>
        ConfigFolder.of({ repository: 'acme/infra', folder }),
      ).toThrow(InvalidConfigFolderError);
    },
  );

  it('remembers the pull request opened there', () => {
    const url = PullRequestUrl.of('https://github.com/acme/infra/pull/12');
    const home = ConfigFolder.of({
      repository: 'acme/infra',
      folder: 'spotlight',
    });

    expect(home.opened(url).pullRequest?.value).toBe(url.value);
    expect(home.opened(url).equals(home)).toBe(false);
  });
});
