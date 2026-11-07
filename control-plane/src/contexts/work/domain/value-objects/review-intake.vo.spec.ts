import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { reviewsOf } from '@work/domain/value-objects/line-map.fake-spec';
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

describe('ReviewIntake', () => {
  it('reviews a pull request labelled with its label, whatever it starts on', () => {
    expect(reviewsOf({}).takes(labelled('Spotlight'))).toBe(true);
    expect(reviewsOf({ start: 'opened' }).takes(labelled('spotlight'))).toBe(
      true,
    );
    expect(reviewsOf({}).takes(labelled('bug'))).toBe(false);
    expect(reviewsOf({ label: 'ai-review' }).takes(labelled('ai-review'))).toBe(
      true,
    );
  });

  it('reviews a labelled draft, since a person adds a label by hand', () => {
    expect(reviewsOf({}).takes(labelled('spotlight', { draft: true }))).toBe(
      true,
    );
  });

  it('reviews a pull request as it opens only when it starts on opening', () => {
    expect(reviewsOf({ start: 'opened' }).takes(requested())).toBe(true);
    expect(reviewsOf({ start: 'mentioned' }).takes(requested())).toBe(false);
  });

  it('reviews a pull request Spotlight is mentioned on, however it starts', () => {
    for (const start of ['opened', 'mentioned'] as const) {
      expect(
        reviewsOf({ start }).takes(mentioned('@spotlight have a look')),
      ).toBe(true);
    }
  });

  it('accepts a mention only of its own handle, as a separate word', () => {
    const policy = reviewsOf({ mention: '@reviewer' });

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
      reviewsOf({ start: 'opened' }).takes(requested({ ours: true })),
    ).toBe(false);
    expect(
      reviewsOf({ start: 'opened', skip: { spotlight: false } }).takes(
        requested({ ours: true }),
      ),
    ).toBe(true);
    expect(
      reviewsOf({}).takes(mentioned('@spotlight look', { ours: true })),
    ).toBe(false);
  });

  it('skips a draft as it opens, but reviews one when requested', () => {
    const policy = reviewsOf({ start: 'opened' });

    expect(policy.takes(requested({ draft: true }))).toBe(false);
    expect(policy.takes(mentioned('@spotlight', { draft: true }))).toBe(true);
    expect(
      reviewsOf({ start: 'opened', skip: { drafts: false } }).takes(
        requested({ draft: true }),
      ),
    ).toBe(true);
  });

  it('skips the authors it names, whatever their case', () => {
    const policy = reviewsOf({
      start: 'opened',
      skip: { authors: ['Dependabot[bot]'] },
    });

    expect(policy.takes(requested({ author: 'dependabot[bot]' }))).toBe(false);
    expect(policy.takes(requested({ author: 'octocat' }))).toBe(true);
    expect(policy.takes(requested({ author: null }))).toBe(true);
  });
});
