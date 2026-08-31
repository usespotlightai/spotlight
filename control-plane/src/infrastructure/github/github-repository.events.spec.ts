import { GitHubRepositoryEvents } from '@infrastructure/github/github-repository.events';
import { describe, expect, it } from 'vitest';

const reading = new GitHubRepositoryEvents();

const closed = (over: Record<string, unknown> = {}) => ({
  action: 'closed',
  pull_request: {
    merged: true,
    html_url: 'https://github.com/acme/api/pull/7',
    ...over,
  },
});

describe('GitHubRepositoryEvents', () => {
  it('reads a merged pull request as the address it was opened at', () => {
    expect(reading.merged('pull_request', closed())).toEqual({
      url: 'https://github.com/acme/api/pull/7',
    });
  });

  it('says nothing of a pull request closed without a merge', () => {
    expect(
      reading.merged('pull_request', closed({ merged: false })),
    ).toBeNull();
  });

  it('says nothing while a pull request is still open', () => {
    expect(
      reading.merged('pull_request', { ...closed(), action: 'opened' }),
    ).toBeNull();
  });

  it('says nothing of an event it was not asked to read', () => {
    expect(reading.merged('push', closed())).toBeNull();
  });

  it('says nothing where the delivery names no address', () => {
    expect(
      reading.merged('pull_request', closed({ html_url: undefined })),
    ).toBeNull();
  });

  it('says nothing of a delivery that is not shaped like one at all', () => {
    expect(reading.merged('pull_request', null)).toBeNull();
    expect(reading.merged(undefined, undefined)).toBeNull();
  });
});
