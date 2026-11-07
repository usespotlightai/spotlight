import { UnplaceableHappeningError } from '@integrations/domain/exceptions/unplaceable-happening.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export const REVIEW_TRIGGERS = ['opened', 'mentioned', 'labelled'] as const;

export type ReviewTrigger = (typeof REVIEW_TRIGGERS)[number];

export type ActivityKind =
  | 'opened'
  | 'labelled'
  | 'merged'
  | 'commented'
  | 'changes-requested'
  | 'checks-failed'
  | 'closed-unmerged';

export type ReportedActivity = Exclude<ActivityKind, 'opened' | 'labelled'>;

export interface PullRequestActivityFacts {
  readonly activity: ActivityKind;
  readonly pullRequest: PullRequestUrl | null;
  readonly branch: string | null;
  readonly labelled: boolean;
  readonly described: boolean;
  readonly comment: string | null;
}

export type PullRequestHappening =
  | {
      readonly kind: 'activity';
      readonly activity: ReportedActivity;
      readonly to: 'its-task' | 'its-review';
      readonly branch: string | null;
      readonly pullRequest: PullRequestUrl | null;
    }
  | {
      readonly kind: 'review-request';
      readonly trigger: ReviewTrigger;
      readonly pullRequest: PullRequestUrl;
    };

const MENTION = '@';

const unplaceable = (activity: ActivityKind): never => {
  throw new UnplaceableHappeningError(`GitHub ${activity} delivery`);
};

const reviewRequest = (
  facts: PullRequestActivityFacts,
  trigger: ReviewTrigger,
): PullRequestHappening[] =>
  facts.pullRequest && facts.described
    ? [{ kind: 'review-request', trigger, pullRequest: facts.pullRequest }]
    : [];

const mentions = (facts: PullRequestActivityFacts): boolean =>
  (facts.activity === 'commented' || facts.activity === 'changes-requested') &&
  (facts.comment?.includes(MENTION) ?? false);

export const PullRequestHappenings = {
  of(facts: PullRequestActivityFacts): readonly PullRequestHappening[] {
    const { activity } = facts;

    if (activity === 'opened') {
      return facts.pullRequest
        ? reviewRequest(facts, 'opened')
        : unplaceable(activity);
    }

    if (activity === 'labelled') {
      return facts.labelled ? reviewRequest(facts, 'labelled') : [];
    }

    if (!facts.branch && !facts.pullRequest) {
      unplaceable(activity);
    }

    return [
      {
        kind: 'activity',
        activity,
        to: 'its-task',
        branch: facts.branch,
        pullRequest: facts.pullRequest,
      },
      ...(facts.pullRequest
        ? [
            {
              kind: 'activity' as const,
              activity,
              to: 'its-review' as const,
              branch: null,
              pullRequest: facts.pullRequest,
            },
          ]
        : []),
      ...(mentions(facts) ? reviewRequest(facts, 'mentioned') : []),
    ];
  },
};
