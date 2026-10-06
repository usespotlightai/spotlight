import type {
  BotActivity,
  BotComment,
  HeardThread,
} from '@github/domain/value-objects/bot-activity.vo';

interface BotHeard {
  readonly reviews: readonly {
    readonly login: string | null;
    readonly byBot: boolean;
  }[];
  readonly botComments: readonly BotComment[];
  readonly threads: readonly HeardThread[];
}

const openerKey = (id: number): string => `comment:${id}`;

const threadKey = (thread: HeardThread): string =>
  thread.opener !== null ? openerKey(thread.opener) : `thread:${thread.id}`;

const loginsOf = (heard: BotHeard): readonly string[] =>
  [
    ...new Set([
      ...heard.reviews.flatMap((each) =>
        each.byBot && each.login ? [each.login] : [],
      ),
      ...heard.botComments.map((each) => each.login),
      ...heard.threads.flatMap((each) =>
        each.byBot && each.login ? [each.login] : [],
      ),
    ]),
  ].sort();

export const botActivityOf = (heard: BotHeard): readonly BotActivity[] =>
  loginsOf(heard).map((login) => {
    const comments = heard.botComments.filter(
      (each) => each.login === login && !each.deleted,
    );
    const threads = heard.threads.filter(
      (each) => each.byBot && each.login === login,
    );

    return {
      login,
      reviews: heard.reviews.filter(
        (each) => each.byBot && each.login === login,
      ).length,
      comments: comments.length,
      threads: new Set([
        ...comments.flatMap((each) =>
          each.on === 'line' && each.opensThread ? [openerKey(each.id)] : [],
        ),
        ...threads.map(threadKey),
      ]).size,
      resolvedThreads: threads.filter((each) => each.resolved).length,
    };
  });
