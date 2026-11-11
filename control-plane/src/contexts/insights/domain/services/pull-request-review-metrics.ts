import type { BotActivity } from '@insights/domain/value-objects/seen-pull-request.vo';

export interface ObservedReview {
  readonly id: number;
  readonly state: 'approved' | 'changes-requested' | 'commented';
  readonly login: string | null;
  readonly byBot: boolean;
  readonly at: Date | null;
  readonly dismissed: boolean;
}

export interface ObservedBotComment {
  readonly id: number;
  readonly on: 'line' | 'conversation';
  readonly login: string;
  readonly opensThread: boolean;
  readonly deleted: boolean;
}

export interface ObservedThread {
  readonly id: string;
  readonly firstCommentId: number | null;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly resolved: boolean;
}

export interface ObservedReviewActivity {
  readonly author: string | null;
  readonly reviews: readonly ObservedReview[];
  readonly botComments: readonly ObservedBotComment[];
  readonly threads: readonly ObservedThread[];
}

export interface ReviewMetrics {
  readonly firstReviewAt: Date | null;
  readonly firstUnblockingReviewAt: Date | null;
  readonly firstApprovedAt: Date | null;
  readonly humanReviewedAt: readonly Date[];
  readonly reviews: number;
  readonly reviewRounds: number;
  readonly botActivity: readonly BotActivity[];
}

const VERDICTS: readonly ObservedReview['state'][] = [
  'approved',
  'changes-requested',
];

const atOf = (review: ObservedReview): number =>
  review.at?.getTime() ?? Number.POSITIVE_INFINITY;

const earliestOf = (reviews: readonly ObservedReview[]): Date | null => {
  const [first] = reviews
    .filter((each) => each.at !== null)
    .sort((a, b) => atOf(a) - atOf(b));

  return first?.at ?? null;
};

const roundsOf = (byPeople: readonly ObservedReview[]): number => {
  const reviews = [...byPeople].sort((a, b) => atOf(a) - atOf(b));
  const verdicts = reviews.filter((each) => VERDICTS.includes(each.state));
  const last = verdicts[verdicts.length - 1];
  const after = last ? reviews.slice(reviews.indexOf(last) + 1) : reviews;

  return verdicts.length + (after.length > 0 ? 1 : 0);
};

const firstCommentKey = (id: number): string => `comment:${id}`;

const threadKey = (thread: ObservedThread): string =>
  thread.firstCommentId !== null
    ? firstCommentKey(thread.firstCommentId)
    : `thread:${thread.id}`;

const botLoginsOf = (activity: ObservedReviewActivity): readonly string[] =>
  [
    ...new Set([
      ...activity.reviews.flatMap((each) =>
        each.byBot && each.login ? [each.login] : [],
      ),
      ...activity.botComments.map((each) => each.login),
      ...activity.threads.flatMap((each) =>
        each.byBot && each.login ? [each.login] : [],
      ),
    ]),
  ].sort();

const botActivityOf = (
  activity: ObservedReviewActivity,
): readonly BotActivity[] =>
  botLoginsOf(activity).map((login) => {
    const comments = activity.botComments.filter(
      (each) => each.login === login && !each.deleted,
    );
    const threads = activity.threads.filter(
      (each) => each.byBot && each.login === login,
    );

    return {
      login,
      reviews: activity.reviews.filter(
        (each) => each.byBot && each.login === login,
      ).length,
      comments: comments.length,
      threads: new Set([
        ...comments.flatMap((each) =>
          each.on === 'line' && each.opensThread
            ? [firstCommentKey(each.id)]
            : [],
        ),
        ...threads.map(threadKey),
      ]).size,
      resolvedThreads: threads.filter((each) => each.resolved).length,
    };
  });

export const reviewMetricsOf = (
  activity: ObservedReviewActivity,
): ReviewMetrics => {
  const byPeople = activity.reviews.filter(
    (each) => !each.byBot && !each.dismissed,
  );

  return {
    firstReviewAt: earliestOf(byPeople),
    firstUnblockingReviewAt: earliestOf(
      activity.reviews.filter(
        (each) => activity.author === null || each.login !== activity.author,
      ),
    ),
    firstApprovedAt: earliestOf(
      activity.reviews.filter(
        (each) => each.state === 'approved' && !each.dismissed,
      ),
    ),
    humanReviewedAt: byPeople
      .flatMap((each) => (each.at ? [each.at] : []))
      .sort((a, b) => a.getTime() - b.getTime()),
    reviews: byPeople.length,
    reviewRounds: roundsOf(byPeople),
    botActivity: botActivityOf(activity),
  };
};
