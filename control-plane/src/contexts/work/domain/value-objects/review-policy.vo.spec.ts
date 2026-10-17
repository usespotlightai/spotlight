import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidReviewPolicyError } from '@work/domain/exceptions/invalid-review-policy.error';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { ReviewAsked } from '@work/domain/value-objects/review-asked.vo';
import { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { describe, expect, it } from 'vitest';

const asked = (over: Partial<ReviewAsked> = {}): ReviewAsked => ({
  asking: 'opened',
  label: null,
  pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
  author: 'octocat',
  outside: false,
  draft: false,
  branch: Branch.of('fix-uploads'),
  said: null,
  ours: false,
  ...over,
});

const mentioned = (body: string, over: Partial<ReviewAsked> = {}) =>
  asked({ asking: 'mentioned', said: Said.of({ body }), ...over });

const labelled = (label: string, over: Partial<ReviewAsked> = {}) =>
  asked({ asking: 'labelled', label, ...over });

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

  it('reviews a labelled draft, since a label is asked for by hand', () => {
    expect(
      ReviewPolicy.of({}).takes(labelled('spotlight', { draft: true })),
    ).toBe(true);
  });

  it('refuses an empty label or one longer than GitHub allows', () => {
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
    expect(ReviewPolicy.of({ start: 'opened' }).takes(asked())).toBe(true);
    expect(ReviewPolicy.of({ start: 'mentioned' }).takes(asked())).toBe(false);
  });

  it('reviews a pull request Spotlight is mentioned on, however it starts', () => {
    for (const start of ['opened', 'mentioned']) {
      expect(
        ReviewPolicy.of({ start }).takes(mentioned('@spotlight have a look')),
      ).toBe(true);
    }
  });

  it('hears a mention only of its own handle, as a separate word', () => {
    const policy = ReviewPolicy.of({ mention: '@reviewer' });

    expect(policy.takes(mentioned('Could @Reviewer look?'))).toBe(true);
    expect(policy.takes(mentioned('@reviewer, please'))).toBe(true);
    expect(policy.takes(mentioned('@spotlight have a look'))).toBe(false);
    expect(policy.takes(mentioned('@reviewers have a look'))).toBe(false);
    expect(policy.takes(mentioned('mail me@reviewer.dev'))).toBe(false);
    expect(policy.takes(asked({ asking: 'mentioned', said: null }))).toBe(
      false,
    );
  });

  it('skips a pull request Spotlight opened, unless told not to', () => {
    expect(
      ReviewPolicy.of({ start: 'opened' }).takes(asked({ ours: true })),
    ).toBe(false);
    expect(
      ReviewPolicy.of({ start: 'opened', skip: { spotlight: false } }).takes(
        asked({ ours: true }),
      ),
    ).toBe(true);
    expect(
      ReviewPolicy.of({}).takes(mentioned('@spotlight look', { ours: true })),
    ).toBe(false);
  });

  it('skips a draft as it opens, but reviews one it is asked to', () => {
    const policy = ReviewPolicy.of({ start: 'opened' });

    expect(policy.takes(asked({ draft: true }))).toBe(false);
    expect(policy.takes(mentioned('@spotlight', { draft: true }))).toBe(true);
    expect(
      ReviewPolicy.of({ start: 'opened', skip: { drafts: false } }).takes(
        asked({ draft: true }),
      ),
    ).toBe(true);
  });

  it('skips the authors it names, whatever their case', () => {
    const policy = ReviewPolicy.of({
      start: 'opened',
      skip: { authors: ['Dependabot[bot]'] },
    });

    expect(policy.takes(asked({ author: 'dependabot[bot]' }))).toBe(false);
    expect(policy.takes(asked({ author: 'octocat' }))).toBe(true);
    expect(policy.takes(asked({ author: null }))).toBe(true);
  });

  it('refuses a start it does not know, or a handle that is not one', () => {
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
