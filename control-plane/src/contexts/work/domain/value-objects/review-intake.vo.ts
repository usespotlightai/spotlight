import type {
  ReviewRequestReceived,
  ReviewTrigger,
} from '@work/domain/value-objects/review-request.vo';

export type ReviewStart = 'opened' | 'mentioned';

export interface ReviewSkips {
  readonly spotlight: boolean;
  readonly drafts: boolean;
  readonly authors: readonly string[];
}

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class ReviewIntake {
  private constructor(
    readonly start: ReviewStart,
    readonly mention: string,
    readonly label: string,
    readonly skip: ReviewSkips,
  ) {}

  static of(input: {
    start: ReviewStart;
    mention: string;
    label: string;
    skip: ReviewSkips;
  }): ReviewIntake {
    return new ReviewIntake(input.start, input.mention, input.label, {
      spotlight: input.skip.spotlight,
      drafts: input.skip.drafts,
      authors: input.skip.authors.map((each) => each.toLowerCase()),
    });
  }

  accepts(trigger: ReviewTrigger): boolean {
    return trigger !== 'opened' || this.start === 'opened';
  }

  mentionedIn(text: string): boolean {
    return new RegExp(
      `(^|[^\\w@/])${escaped(this.mention)}(?![\\w-])`,
      'i',
    ).test(text);
  }

  takes(request: ReviewRequestReceived): boolean {
    if (!this.accepts(request.trigger)) {
      return false;
    }

    if (
      request.trigger === 'mentioned' &&
      !this.mentionedIn(request.anchor?.body ?? '')
    ) {
      return false;
    }

    if (
      request.trigger === 'labelled' &&
      request.label?.toLowerCase() !== this.label.toLowerCase()
    ) {
      return false;
    }

    if (this.skip.spotlight && request.ours) {
      return false;
    }

    if (this.skip.drafts && request.draft && request.trigger === 'opened') {
      return false;
    }

    return !(
      request.author && this.skip.authors.includes(request.author.toLowerCase())
    );
  }

  equals(other: ReviewIntake): boolean {
    return (
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
