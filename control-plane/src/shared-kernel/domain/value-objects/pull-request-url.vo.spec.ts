import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { describe, expect, it } from 'vitest';

describe('PullRequestUrl', () => {
  it('reads the repository the pull request lives in from the URL', () => {
    const url = PullRequestUrl.of('https://github.com/acme/api/pull/7');

    expect(url.repository?.value).toBe('acme/api');
  });

  it('reads it whatever the host', () => {
    const url = PullRequestUrl.of('https://git.example.com/acme/web/pull/12');

    expect(url.repository?.value).toBe('acme/web');
  });

  it('is nothing where the URL names no repository', () => {
    expect(PullRequestUrl.of('https://github.com/').repository).toBeNull();
  });
});
