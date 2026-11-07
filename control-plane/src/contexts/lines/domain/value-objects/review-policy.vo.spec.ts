import { InvalidReviewPolicyError } from '@lines/domain/exceptions/invalid-review-policy.error';
import { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import { describe, expect, it } from 'vitest';

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
