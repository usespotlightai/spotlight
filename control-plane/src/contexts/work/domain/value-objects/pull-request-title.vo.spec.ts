import { InvalidPullRequestTitleError } from '@work/domain/exceptions/invalid-pull-request-title.error';
import { PullRequestTitle } from '@work/domain/value-objects/pull-request-title.vo';
import { describe, expect, it } from 'vitest';

describe('PullRequestTitle', () => {
  it('keeps a title without the space around it', () => {
    expect(PullRequestTitle.of('  Add the login page ').value).toBe(
      'Add the login page',
    );
  });

  it('refuses an empty title', () => {
    expect(() => PullRequestTitle.of('   ')).toThrow(
      InvalidPullRequestTitleError,
    );
  });

  it('refuses a title longer than GitHub takes', () => {
    expect(() => PullRequestTitle.of('a'.repeat(257))).toThrow(
      InvalidPullRequestTitleError,
    );
  });

  it('equals a title with the same text', () => {
    expect(
      PullRequestTitle.of('Fix it').equals(PullRequestTitle.of(' Fix it')),
    ).toBe(true);
  });
});
