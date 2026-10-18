export interface BotComment {
  readonly id: number;
  readonly on: 'line' | 'conversation';
  readonly login: string;
  readonly opensThread: boolean;
  readonly deleted: boolean;
}

export interface PullRequestThread {
  readonly id: string;
  readonly firstCommentId: number | null;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly resolved: boolean;
}

export interface BotActivity {
  readonly login: string;
  readonly reviews: number;
  readonly comments: number;
  readonly threads: number;
  readonly resolvedThreads: number;
}
