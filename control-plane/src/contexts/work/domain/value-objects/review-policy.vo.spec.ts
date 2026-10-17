import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidReviewPolicyError } from '@work/domain/exceptions/invalid-review-policy.error';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import type { ReviewRequestReceived } from '@work/domain/value-objects/review-request.vo';
import { describe, expect, it } from 'vitest';

const requested = (
  over: Partial<ReviewRequestReceived> = {},
): ReviewRequestReceived => ({
  trigger: 'opened',
  label: null,
  pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  author: 'octocat',
  outside: false,
  draft: false,
  branch: Branch.of('fix-uploads'),
  anchor: null,
  ours: false,
  ...over,
});

const mentioned = (body: string, over: Partial<ReviewRequestReceived> = {}) =>
  requested({ trigger: 'mentioned', anchor: Anchor.of({ body }), ...over });

const labelled = (label: string, over: Partial<ReviewRequestReceived> = {}) =>
  requested({ trigger: 'labelled', label, ...over });

describe('ReviewPolicy', () => {
  it('waits to be mentioned, and skips Spotlight’s own pull requests and drafts, unless told otherwise', () => {
    const policy = ReviewPolicy.of({});

    expect(policy.start).toBe('mentioned');
    expect(policy.mention).toBe('@spotlight');
    expect(policy.label).toBe('spotlight');
    expect(policy.skip).toEqual({
      spotlight: true,
      drafts: true,
      authors: [],
    });
  });

  it('reviews a pull request labelled with its label, whatever it starts on', () => {
    expect(ReviewPolicy.of({}).takes(labelled('Spotlight'))).toBe(true);
    expect(
      ReviewPolicy.of({ start: 'opened' }).takes(labelled('spotlight')),
    ).toBe(true);
    expect(ReviewPolicy.of({}).takes(labelled('bug'))).toBe(false);
    expect(
      ReviewPolicy.of({ label: 'ai-review' }).takes(labelled('ai-review')),
    ).toBe(true);
  });

  it('reviews a labelled draft, since a person adds a label by hand', () => {
    expect(
      ReviewPolicy.of({}).takes(labelled('spotlight', { draft: true })),
    ).toBe(true);
  });

  it('rejects an empty label or one longer than GitHub allows', () => {
    expect(() => ReviewPolicy.of({ label: ' ' })).toThrow(
      InvalidReviewPolicyError,
    );
    expect(() => ReviewPolicy.of({ label: 'x'.repeat(51) })).toThrow(
      InvalidReviewPolicyError,
    );
  });

  it('tells policies with different labels apart', () => {
    expect(
      ReviewPolicy.of({}).equals(ReviewPolicy.of({ label: 'ai-review' })),
    ).toBe(false);
  });

  it('reviews a pull request as it opens only when it starts on opening', () => {
    expect(ReviewPolicy.of({ start: 'opened' }).takes(requested())).toBe(true);
    expect(ReviewPolicy.of({ start: 'mentioned' }).takes(requested())).toBe(
      false,
    );
  });

  it('reviews a pull request Spotlight is mentioned on, however it starts', () => {
    for (const start of ['opened', 'mentioned']) {
      expect(
        ReviewPolicy.of({ start }).takes(mentioned('@spotlight have a look')),
      ).toBe(true);
    }
  });

  it('accepts a mention only of its own handle, as a separate word', () => {
    const policy = ReviewPolicy.of({ mention: '@reviewer' });

    expect(policy.takes(mentioned('Could @Reviewer look?'))).toBe(true);
    expect(policy.takes(mentioned('@reviewer, please'))).toBe(true);
    expect(policy.takes(mentioned('@spotlight have a look'))).toBe(false);
    expect(policy.takes(mentioned('@reviewers have a look'))).toBe(false);
    expect(policy.takes(mentioned('mail me@reviewer.dev'))).toBe(false);
    expect(
      policy.takes(requested({ trigger: 'mentioned', anchor: null })),
    ).toBe(false);
  });

  it('skips a pull request Spotlight opened, unless told not to', () => {
    expect(
      ReviewPolicy.of({ start: 'opened' }).takes(requested({ ours: true })),
    ).toBe(false);
    expect(
      ReviewPolicy.of({ start: 'opened', skip: { spotlight: false } }).takes(
        requested({ ours: true }),
      ),
    ).toBe(true);
    expect(
      ReviewPolicy.of({}).takes(mentioned('@spotlight look', { ours: true })),
    ).toBe(false);
  });

  it('skips a draft as it opens, but reviews one when requested', () => {
    const policy = ReviewPolicy.of({ start: 'opened' });

    expect(policy.takes(requested({ draft: true }))).toBe(false);
    expect(policy.takes(mentioned('@spotlight', { draft: true }))).toBe(true);
    expect(
      ReviewPolicy.of({ start: 'opened', skip: { drafts: false } }).takes(
        requested({ draft: true }),
      ),
    ).toBe(true);
  });

  it('skips the authors it names, whatever their case', () => {
    const policy = ReviewPolicy.of({
      start: 'opened',
      skip: { authors: ['Dependabot[bot]'] },
    });

    expect(policy.takes(requested({ author: 'dependabot[bot]' }))).toBe(false);
    expect(policy.takes(requested({ author: 'octocat' }))).toBe(true);
    expect(policy.takes(requested({ author: null }))).toBe(true);
  });

  it('rejects a start it does not know, or a handle that is not one', () => {
    expect(() => ReviewPolicy.of({ start: 'pushed' })).toThrow(
      InvalidReviewPolicyError,
    );
    expect(() => ReviewPolicy.of({ mention: 'spotlight' })).toThrow(
      InvalidReviewPolicyError,
    );
  });

  it('is the same policy where every part is the same', () => {
    expect(
      ReviewPolicy.of({ skip: { authors: ['a'] } }).equals(
        ReviewPolicy.of({ skip: { authors: ['A'] } }),
      ),
    ).toBe(true);
    expect(
      ReviewPolicy.of({}).equals(ReviewPolicy.of({ start: 'opened' })),
    ).toBe(false);
    expect(
      ReviewPolicy.of({ skip: { authors: ['a', 'b'] } }).equals(
        ReviewPolicy.of({ skip: { authors: ['b', 'a'] } }),
      ),
    ).toBe(true);
  });
});
