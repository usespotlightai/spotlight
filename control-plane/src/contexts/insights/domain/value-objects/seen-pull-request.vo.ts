import { InvalidPullRequestRecordError } from '@insights/domain/exceptions/invalid-pull-request-record.error';
import {
  type ObservedReviewActivity,
  type ReviewMetrics,
  reviewMetricsOf,
} from '@insights/domain/services/pull-request-review-metrics';
import type { PullRequestState } from '@insights/domain/value-objects/pull-request-state';

export interface BotActivity {
  readonly login: string;
  readonly reviews: number;
  readonly comments: number;
  readonly threads: number;
  readonly resolvedThreads: number;
}

interface DraftPeriod {
  readonly from: Date;
  readonly to: Date | null;
}

export interface SeenPullRequestFields {
  readonly repository: string;
  readonly number: number;
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly openedAt: Date;
  readonly state: PullRequestState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly readyForReviewAt: Date | null;
  readonly draftPeriods: readonly DraftPeriod[];
  readonly firstReviewAt: Date | null;
  readonly firstUnblockingReviewAt: Date | null;
  readonly firstApprovedAt: Date | null;
  readonly humanReviewedAt: readonly Date[];
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly reviewComments: number;
  readonly botActivity: readonly BotActivity[];
  readonly isRevert: boolean;
  readonly revertedBy: string | null;
  readonly version: number;
}

export type ObservedPullRequest = Omit<
  SeenPullRequestFields,
  keyof ReviewMetrics
> &
  Omit<ObservedReviewActivity, 'author'>;

const COUNTS = [
  'additions',
  'deletions',
  'changedFiles',
  'reviews',
  'reviewRounds',
  'reviewComments',
  'version',
] as const;

const count = (value: number | null): boolean =>
  value === null || (Number.isInteger(value) && value >= 0);

export class SeenPullRequest implements SeenPullRequestFields {
  readonly repository!: string;
  readonly number!: number;
  readonly title!: string;
  readonly author!: string | null;
  readonly authorIsBot!: boolean;
  readonly branch!: string | null;
  readonly additions!: number | null;
  readonly deletions!: number | null;
  readonly changedFiles!: number | null;
  readonly openedAt!: Date;
  readonly state!: PullRequestState;
  readonly closedAt!: Date | null;
  readonly updatedAt!: Date;
  readonly readyForReviewAt!: Date | null;
  readonly draftPeriods!: readonly DraftPeriod[];
  readonly firstReviewAt!: Date | null;
  readonly firstUnblockingReviewAt!: Date | null;
  readonly firstApprovedAt!: Date | null;
  readonly humanReviewedAt!: readonly Date[];
  readonly reviews!: number;
  readonly reviewRounds!: number;
  readonly reviewComments!: number;
  readonly botActivity!: readonly BotActivity[];
  readonly isRevert!: boolean;
  readonly revertedBy!: string | null;
  readonly version!: number;

  private constructor(fields: SeenPullRequestFields) {
    Object.assign(this, fields);
  }

  static of(fields: SeenPullRequestFields): SeenPullRequest {
    if (!fields.repository.trim() || !fields.title.trim()) {
      throw new InvalidPullRequestRecordError(
        'must name its repository and title',
      );
    }
    if (!Number.isInteger(fields.number) || fields.number < 1) {
      throw new InvalidPullRequestRecordError('must have a positive number');
    }
    if (COUNTS.some((each) => !count(fields[each]))) {
      throw new InvalidPullRequestRecordError(
        'must count changes, reviews and its version from zero',
      );
    }
    if (fields.state === 'open' && fields.closedAt !== null) {
      throw new InvalidPullRequestRecordError(
        'that is open must have no close time',
      );
    }

    return new SeenPullRequest(fields);
  }

  static observed(observed: ObservedPullRequest): SeenPullRequest {
    const { reviews, botComments, threads, ...facts } = observed;

    return SeenPullRequest.of({
      ...facts,
      ...reviewMetricsOf({
        author: observed.author,
        reviews,
        botComments,
        threads,
      }),
    });
  }
}
