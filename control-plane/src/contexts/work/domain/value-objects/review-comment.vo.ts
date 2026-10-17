import { InvalidReviewCommentError } from '@work/domain/exceptions/invalid-review-comment.error';

export class ReviewComment {
  private constructor(readonly value: string) {}

  static of(value: string): ReviewComment {
    const named = value.trim();

    if (!named) {
      throw new InvalidReviewCommentError('must name the review comment');
    }

    return new ReviewComment(named);
  }

  equals(other: ReviewComment): boolean {
    return this.value === other.value;
  }
}
