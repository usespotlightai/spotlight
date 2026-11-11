import { InvalidPullRequestRecordError } from '@insights/domain/exceptions/invalid-pull-request-record.error';
import { seenOf } from '@insights/pull-requests.fake-spec';
import { describe, expect, it } from 'vitest';

describe('SeenPullRequest', () => {
  it('keeps what GitHub said of a pull request', () => {
    expect(seenOf({ title: 'Retry uploads' }).title).toBe('Retry uploads');
  });

  it('refuses negative counts, a number below one, and an open pull request with a close time', () => {
    expect(() => seenOf({ additions: -1 })).toThrow(
      InvalidPullRequestRecordError,
    );
    expect(() => seenOf({ number: 0 })).toThrow(InvalidPullRequestRecordError);
    expect(() =>
      seenOf({ state: 'open', closedAt: new Date('2026-09-28T10:00:00Z') }),
    ).toThrow(InvalidPullRequestRecordError);
  });
});
