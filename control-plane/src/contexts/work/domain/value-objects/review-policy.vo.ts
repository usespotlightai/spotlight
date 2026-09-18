import { InvalidReviewPolicyError } from '@work/domain/exceptions/invalid-review-policy.error';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import type {
  ReviewAsked,
  ReviewAsking,
} from '@work/domain/value-objects/review-asked.vo';

export const REVIEW_STARTS = ['opened', 'mentioned'] as const;

export type ReviewStart = (typeof REVIEW_STARTS)[number];

export const DEFAULT_MENTION = '@spotlight';

const MENTION = /^@[A-Za-z0-9][A-Za-z0-9_-]*(\[bot\])?$/;

export const reviewsOn = (role: LineRole | null): boolean =>
  role?.equals(LineRole.REVIEW) ?? false;

export interface ReviewSkips {
  readonly spotlight: boolean;
  readonly drafts: boolean;
  readonly authors: readonly string[];
}

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class ReviewPolicy {
  private readonly kind = 'review-policy';

  private constructor(
    readonly start: ReviewStart,
    readonly mention: string,
    readonly skip: ReviewSkips,
  ) {}

  static of(input: {
    start?: string;
    mention?: string;
    skip?: Partial<ReviewSkips>;
  }): ReviewPolicy {
    const start = input.start ?? 'mentioned';

    if (!(REVIEW_STARTS as readonly string[]).includes(start)) {
      throw new InvalidReviewPolicyError(
        'starts when a pull request is opened or when Spotlight is mentioned on one',
      );
    }

    const mention = (input.mention ?? DEFAULT_MENTION).trim();

    if (!MENTION.test(mention)) {
      throw new InvalidReviewPolicyError(
        `is mentioned by a handle, as in ${DEFAULT_MENTION}`,
      );
    }

    const authors = (input.skip?.authors ?? [])
      .map((each) => each.trim().toLowerCase())
      .filter(Boolean);

    return new ReviewPolicy(start as ReviewStart, mention, {
      spotlight: input.skip?.spotlight ?? true,
      drafts: input.skip?.drafts ?? true,
      authors: [...new Set(authors)].sort(),
    });
  }

  asks(asking: ReviewAsking): boolean {
    return asking === 'mentioned' || this.start === 'opened';
  }

  mentionedIn(text: string): boolean {
    return new RegExp(
      `(^|[^\\w@/])${escaped(this.mention)}(?![\\w-])`,
      'i',
    ).test(text);
  }

  takes(asked: ReviewAsked): boolean {
    if (!this.asks(asked.asking)) {
      return false;
    }

    if (
      asked.asking === 'mentioned' &&
      !this.mentionedIn(asked.said?.body ?? '')
    ) {
      return false;
    }

    if (this.skip.spotlight && asked.ours) {
      return false;
    }

    if (this.skip.drafts && asked.draft && asked.asking === 'opened') {
      return false;
    }

    return !(
      asked.author && this.skip.authors.includes(asked.author.toLowerCase())
    );
  }

  equals(other: ReviewPolicy): boolean {
    return (
      this.kind === other.kind &&
      this.start === other.start &&
      this.mention === other.mention &&
      this.skip.spotlight === other.skip.spotlight &&
      this.skip.drafts === other.skip.drafts &&
      this.skip.authors.length === other.skip.authors.length &&
      this.skip.authors.every((each, at) => each === other.skip.authors[at])
    );
  }
}
