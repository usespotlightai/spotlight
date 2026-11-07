import { InvalidReviewPolicyError } from '@lines/domain/exceptions/invalid-review-policy.error';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';

export const REVIEW_STARTS = ['opened', 'mentioned'] as const;

export type ReviewStart = (typeof REVIEW_STARTS)[number];

const DEFAULT_MENTION = '@spotlight';

const DEFAULT_LABEL = 'spotlight';

const LONGEST_LABEL = 50;

const MENTION = /^@[A-Za-z0-9][A-Za-z0-9_-]*(\[bot\])?$/;

export const reviewsOn = (role: LineRole | null): boolean =>
  role?.equals(LineRole.REVIEW) ?? false;

export interface ReviewSkips {
  readonly spotlight: boolean;
  readonly drafts: boolean;
  readonly authors: readonly string[];
}

export class ReviewPolicy {
  private readonly kind = 'review-policy';

  private constructor(
    readonly start: ReviewStart,
    readonly mention: string,
    readonly label: string,
    readonly skip: ReviewSkips,
  ) {}

  static of(input: {
    start?: string;
    mention?: string;
    label?: string;
    skip?: Partial<ReviewSkips>;
  }): ReviewPolicy {
    const start = input.start ?? 'mentioned';

    if (!(REVIEW_STARTS as readonly string[]).includes(start)) {
      throw new InvalidReviewPolicyError(
        'must start on an opened pull request or a mention',
      );
    }

    const mention = (input.mention ?? DEFAULT_MENTION).trim();

    if (!MENTION.test(mention)) {
      throw new InvalidReviewPolicyError(
        `mention must be a handle, as in ${DEFAULT_MENTION}`,
      );
    }

    const label = (input.label ?? DEFAULT_LABEL).trim();

    if (label.length === 0 || label.length > LONGEST_LABEL) {
      throw new InvalidReviewPolicyError(
        `label must be 1 to ${LONGEST_LABEL} characters, as in ${DEFAULT_LABEL}`,
      );
    }

    const authors = (input.skip?.authors ?? [])
      .map((each) => each.trim().toLowerCase())
      .filter(Boolean);

    return new ReviewPolicy(start as ReviewStart, mention, label, {
      spotlight: input.skip?.spotlight ?? true,
      drafts: input.skip?.drafts ?? true,
      authors: [...new Set(authors)].sort(),
    });
  }

  equals(other: ReviewPolicy): boolean {
    return (
      this.kind === other.kind &&
      this.start === other.start &&
      this.mention === other.mention &&
      this.label === other.label &&
      this.skip.spotlight === other.skip.spotlight &&
      this.skip.drafts === other.skip.drafts &&
      this.skip.authors.length === other.skip.authors.length &&
      this.skip.authors.every((each, at) => each === other.skip.authors[at])
    );
  }
}
