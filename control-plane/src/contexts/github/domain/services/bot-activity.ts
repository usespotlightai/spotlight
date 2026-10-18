import type {
  BotActivity,
  BotComment,
  PullRequestThread,
} from '@github/domain/value-objects/bot-activity.vo';

interface BotWebhookEvent {
  readonly reviews: readonly {
    readonly login: string | null;
    readonly byBot: boolean;
  }[];
  readonly botComments: readonly BotComment[];
  readonly threads: readonly PullRequestThread[];
}

const firstCommentKey = (id: number): string => `comment:${id}`;

const threadKey = (thread: PullRequestThread): string =>
  thread.firstCommentId !== null
    ? firstCommentKey(thread.firstCommentId)
    : `thread:${thread.id}`;

const loginsOf = (activity: BotWebhookEvent): readonly string[] =>
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

export const botActivityOf = (
  activity: BotWebhookEvent,
): readonly BotActivity[] =>
  loginsOf(activity).map((login) => {
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
