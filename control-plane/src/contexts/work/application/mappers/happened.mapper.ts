import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type {
  Happened,
  InboundAttachment,
  ReviewPayload,
  TaskMark,
} from '@work/application/contracts/happenings.contract';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import type { HappeningPayload } from '@work/domain/value-objects/happening-payload';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { OpensWith } from '@work/domain/value-objects/opens-with';
import {
  ReviewRequest,
  reviewTrigger,
} from '@work/domain/value-objects/review-request.vo';

export interface ReceivedHappening {
  readonly payload: HappeningPayload;
  readonly correlationKeys: CorrelationKeys;
  readonly anchor: Anchor | null;
  readonly authorEmail: string | null;
  readonly ourOwn: boolean;
  readonly opens: OpensWith | null;
  readonly chat: StartsChat | null;
  readonly attachments: readonly InboundAttachment[];
}

export interface StartsChat {
  readonly email: string | null;
  readonly harness: string | null;
  readonly marks: readonly ChatMark[];
}

const reviewOf = (
  review: ReviewPayload | null | undefined,
): ReviewRequest | null => {
  if (!review) {
    return null;
  }

  return ReviewRequest.of({
    trigger: reviewTrigger(review.trigger),
    label: review.label?.trim() || null,
    pullRequest: PullRequestUrl.of(review.pullRequest),
    author: review.author?.trim() || null,
    // oxlint-disable-next-line typescript/no-unnecessary-boolean-literal-compare -- a stored payload may lack it, and then it is outside
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
    const correlationKeys = CorrelationKeys.of({
      branch: happened.correlationKeys.branch,
      marks: happened.correlationKeys.marks.map((each) =>
        HappenedMapper.markOf(each),
      ),
    });

    if (!correlationKeys) {
      return null;
    }

    const opens = happened.opens;

    return {
      payload: {
        happening: Happening.of(happened.happening),
        summary: happened.summary,
        answers: happened.answers,
        state: happened.state,
        closedPullRequest: happened.closedPullRequest
          ? PullRequestUrl.of(happened.closedPullRequest)
          : null,
      },
      correlationKeys,
      anchor: happened.message ? Anchor.of(happened.message) : null,
      authorEmail: happened.authorEmail?.trim() || null,
      ourOwn: happened.ourOwn,
      opens: opens
        ? {
            lineRole: LineRole.of(opens.lineRole),
            station: opens.station ? StationKey.parsed(opens.station) : null,
            title: opens.title,
            description: opens.description,
            assignEmail: opens.assignEmail,
            marks: opens.marks.map((each) => HappenedMapper.markOf(each)),
            review: reviewOf(opens.review),
          }
        : null,
      chat: happened.chat
        ? {
            email: happened.chat.email?.trim() || null,
            harness: happened.chat.harness,
            marks: happened.chat.marks.map((each) =>
              ChatMark.of(HappenedMapper.markOf(each), each.finds),
            ),
          }
        : null,
      attachments: happened.attachments ?? [],
    };
  },
};
