import type { ParsedProfile } from '@configuration/domain/aggregates/harness-profile.aggregate';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const HARNESS_REVIEW = Symbol('HARNESS_REVIEW');

export interface ReviewNote {
  readonly at: FieldPath;
  readonly reason: string;
}

export interface HarnessReview {
  readonly problems: readonly ReviewNote[];
  readonly warnings: readonly ReviewNote[];
}

export interface HarnessReviewPort {
  review(parsed: ParsedProfile): HarnessReview;
}
