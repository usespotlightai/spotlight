import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidConfigHomeError } from '@work/domain/exceptions/invalid-config-home.error';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { describe, expect, it } from 'vitest';

describe('ConfigHome', () => {
  it('keeps a folder in a repository', () => {
    const home = ConfigHome.of({
      repository: 'acme/infra',
      folder: 'spotlight',
    });

    expect(home.repository.value).toBe('acme/infra');
    expect(home.folder).toBe('spotlight');
    expect(home.pullRequest).toBeNull();
  });

  it('reads a folder with slashes around it as the folder itself', () => {
    expect(
      ConfigHome.of({ repository: 'acme/infra', folder: ' /infra/spotlight/ ' })
        .folder,
    ).toBe('infra/spotlight');
  });

  it('refuses a repository that is not owner/name', () => {
    expect(() =>
      ConfigHome.of({ repository: 'infra', folder: 'spotlight' }),
    ).toThrow(InvalidConfigHomeError);
  });

  it.each(['', '..', 'a/../b', 'with space', 'a\\b'])(
    'refuses the folder %j',
    (folder) => {
      expect(() => ConfigHome.of({ repository: 'acme/infra', folder })).toThrow(
        InvalidConfigHomeError,
      );
    },
  );

  it('remembers the pull request opened there', () => {
    const url = PullRequestUrl.of('https://github.com/acme/infra/pull/12');
    const home = ConfigHome.of({
      repository: 'acme/infra',
      folder: 'spotlight',
    });

    expect(home.opened(url).pullRequest?.value).toBe(url.value);
    expect(home.opened(url).equals(home)).toBe(false);
  });
});
