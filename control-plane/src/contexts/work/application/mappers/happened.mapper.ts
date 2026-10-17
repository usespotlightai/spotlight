import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type {
  Arriving,
  Happened,
  ReviewPayload,
  TaskMark,
} from '@work/application/contracts/happenings.contract';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import {
  Happening,
  type HappeningPayload,
} from '@work/domain/value-objects/happening.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import {
  type ReviewRequest,
  reviewRequested,
  reviewTrigger,
} from '@work/domain/value-objects/review-request.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';

export interface ReceivedHappening {
  readonly payload: HappeningPayload;
  readonly concerns: Concerns;
  readonly anchor: Anchor | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWith | null;
  readonly attachments: readonly Arriving[];
}

const reviewOf = (
  review: ReviewPayload | null | undefined,
): ReviewRequest | null => {
  if (!review) {
    return null;
  }

  return reviewRequested({
    trigger: reviewTrigger(review.trigger),
    label: review.label?.trim() || null,
    pullRequest: PullRequestUrl.of(review.pullRequest),
    author: review.author?.trim() || null,
    outside: review.outside !== false,
    draft: review.draft,
    branch: review.branch ? Branch.of(review.branch) : null,
  });
};

export const HappenedMapper = {
  markOf(mark: TaskMark): Mark {
    return Mark.of(mark.kind, mark.value);
  },

  toReceivedHappening(happened: Happened): ReceivedHappening | null {
    const concerns = Concerns.of({
      branch: happened.concerns.branch,
      marks: happened.concerns.marks.map(HappenedMapper.markOf),
    });

    if (!concerns) {
      return null;
    }

    const opens = happened.opens;

    return {
      payload: {
        happening: Happening.of(happened.happening),
        summary: happened.summary,
        answers: happened.answers,
        state: happened.state,
      },
      concerns,
      anchor: happened.message ? Anchor.of(happened.message) : null,
      ourOwn: happened.ourOwn,
      opens: opens
        ? {
            onto: LineRole.of(opens.onto),
            at: opens.at ? StationKey.parsed(opens.at) : null,
            title: opens.title,
            description: opens.description,
            assignEmail: opens.assignEmail,
            marks: opens.marks.map(HappenedMapper.markOf),
            review: reviewOf(opens.review),
          }
        : null,
      attachments: happened.attachments ?? [],
    };
  },
};
