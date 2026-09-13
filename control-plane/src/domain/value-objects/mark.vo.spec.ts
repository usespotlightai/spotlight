import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import { Mark } from '@domain/value-objects/mark.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { describe, expect, it } from 'vitest';

describe('Mark', () => {
  it('holds the kind of handle it is and what the world calls it', () => {
    const mark = Mark.of('linear.issue', 'ENG-42');

    expect(mark.kind).toBe('linear.issue');
    expect(mark.value).toBe('ENG-42');
  });

  it('knows a pull request by its address', () => {
    const url = PullRequestUrl.of('https://github.com/acme/api/pull/7');

    expect(Mark.pullRequest(url)).toEqual(
      Mark.of('git.pull-request', url.value),
    );
  });

  it('is the same mark as another of the same kind and value', () => {
    expect(
      Mark.of('linear.issue', 'ENG-42').equals(
        Mark.of('linear.issue', 'ENG-42'),
      ),
    ).toBe(true);
  });

  it('is not the same mark as one of another kind holding the same value', () => {
    expect(
      Mark.of('linear.issue', '7').equals(Mark.of('sentry.fingerprint', '7')),
    ).toBe(false);
  });

  it('refuses a kind that does not name its source first', () => {
    expect(() => Mark.of('issue', 'ENG-42')).toThrow(InvalidIdentifierError);
    expect(() => Mark.of('Linear.issue', 'ENG-42')).toThrow(
      InvalidIdentifierError,
    );
  });

  it('refuses a handle that names nothing', () => {
    expect(() => Mark.of('linear.issue', '   ')).toThrow(
      InvalidIdentifierError,
    );
  });
});
