import { createHash } from 'node:crypto';
import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type {
  PullRequestAbout,
  PullRequestActivity,
  PullRequestActivityKind,
  PullRequestRemark,
} from '@github/application/dto/pull-request-activity.dto';
import type {
  Heard,
  TranslatedDelivery,
  WebhookTranslationPort,
} from '@github/application/ports/webhook-translation.port';
import { unsigned } from '@github/infrastructure/github/spotlight-signature';

interface Payload {
  readonly action?: unknown;
  readonly installation?: { readonly id?: unknown };
  readonly pull_request?: Pull;
  readonly issue?: Described & {
    readonly pull_request?: { readonly html_url?: unknown };
  };
  readonly comment?: Remark & ReviewComment;
  readonly review?: Remark & { readonly state?: unknown };
  readonly check_suite?: {
    readonly conclusion?: unknown;
    readonly head_branch?: unknown;
    readonly pull_requests?: readonly { readonly html_url?: unknown }[];
  };
  readonly sender?: { readonly type?: unknown };
  readonly ref?: unknown;
  readonly repository?: {
    readonly full_name?: unknown;
    readonly default_branch?: unknown;
  };
  readonly commits?: readonly {
    readonly added?: readonly unknown[];
    readonly removed?: readonly unknown[];
    readonly modified?: readonly unknown[];
  }[];
}

interface Described {
  readonly title?: unknown;
  readonly body?: unknown;
  readonly draft?: unknown;
  readonly user?: { readonly login?: unknown };
}

interface Pull extends Described {
  readonly merged?: unknown;
  readonly merge_commit_sha?: unknown;
  readonly closed_at?: unknown;
  readonly html_url?: unknown;
  readonly head?: { readonly ref?: unknown };
}

interface Remark {
  readonly node_id?: unknown;
  readonly body?: unknown;
  readonly user?: { readonly type?: unknown; readonly login?: unknown };
  readonly path?: unknown;
  readonly line?: unknown;
  readonly original_line?: unknown;
  readonly start_line?: unknown;
  readonly original_start_line?: unknown;
}

interface ReviewComment {
  readonly id?: unknown;
  readonly html_url?: unknown;
  readonly side?: unknown;
  readonly subject_type?: unknown;
  readonly in_reply_to_id?: unknown;
  readonly created_at?: unknown;
}

const REVIEW_COMMENT_ACTIONS = ['created', 'edited', 'deleted'] as const;

const OPENING_ACTIONS: readonly unknown[] = [
  'opened',
  'reopened',
  'ready_for_review',
];

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const at = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null;

const named = (value: unknown): string | null =>
  (typeof value === 'number' || typeof value === 'string') &&
  /^\d+$/.test(String(value).trim())
    ? String(value).trim()
    : null;

const writtenAt = (value: unknown): Date | null => {
  const written = typeof value === 'string' ? new Date(value) : null;

  return written && !Number.isNaN(written.getTime()) ? written : null;
};

const headed = (delivery: GitHubDelivery, name: string): string | undefined => {
  const value = delivery.headers[name];

  return Array.isArray(value) ? value[0] : value;
};

const remarked = (remark: Remark | undefined): PullRequestRemark | null =>
  remark && (text(remark.body) || text(remark.path))
    ? {
        body: text(remark.body)?.trim() ?? '',
        path: text(remark.path)?.trim() ?? null,
        from:
          at(remark.start_line) ?? at(remark.line) ?? at(remark.original_line),
        to:
          at(remark.start_line) !== null
            ? (at(remark.line) ?? at(remark.original_line))
            : null,
        id: text(remark.node_id),
      }
    : null;

const described = (pull: Described | undefined): PullRequestAbout | null => {
  const title = text(pull?.title);

  return pull && title
    ? {
        title: title.trim(),
        body: text(pull.body)?.trim() ?? null,
        author: text(pull.user?.login),
        draft: pull.draft === true,
      }
    : null;
};

const byBot = (payload: Payload): boolean =>
  payload.sender?.type === 'Bot' ||
  payload.comment?.user?.type === 'Bot' ||
  payload.review?.user?.type === 'Bot';

const activityOf = (
  event: string | undefined,
  payload: Payload,
): PullRequestActivityKind | null => {
  if (event === 'pull_request' && OPENING_ACTIONS.includes(payload.action)) {
    return 'opened';
  }

  if (event === 'pull_request' && payload.action === 'closed') {
    return payload.pull_request?.merged === true ? 'merged' : 'closed-unmerged';
  }

  if (event === 'pull_request_review') {
    return payload.review?.state === 'changes_requested'
      ? 'changes-requested'
      : payload.action === 'submitted'
        ? 'commented'
        : null;
  }

  if (
    (event === 'issue_comment' || event === 'pull_request_review_comment') &&
    payload.action === 'created'
  ) {
    return 'commented';
  }

  if (event === 'check_suite' && payload.action === 'completed') {
    return payload.check_suite?.conclusion === 'failure'
      ? 'checks-failed'
      : null;
  }

  return null;
};

const pullRequestActivity = (
  event: string | undefined,
  payload: Payload,
): Heard[] => {
  const activity = activityOf(event, payload);

  if (!activity) {
    return [];
  }

  const read: PullRequestActivity = {
    activity,
    branch:
      text(payload.pull_request?.head?.ref) ??
      text(payload.check_suite?.head_branch),
    pullRequest:
      text(payload.pull_request?.html_url) ??
      text(payload.issue?.pull_request?.html_url) ??
      text(payload.check_suite?.pull_requests?.[0]?.html_url),
    about: described(payload.pull_request) ?? described(payload.issue),
    remark: remarked(payload.comment) ?? remarked(payload.review),
    byBot: activity !== 'opened' && byBot(payload),
  };

  return [{ kind: 'pull-request-activity', activity: read }];
};

const reviewComment = (payload: Payload): Heard[] => {
  const comment = payload.comment;
  const action = REVIEW_COMMENT_ACTIONS.find((each) => each === payload.action);
  const pullRequest = text(payload.pull_request?.html_url);
  const id = at(comment?.id);
  const url = text(comment?.html_url);
  const path = text(comment?.path);

  if (!comment || !action || !pullRequest || !id || !url || !path) {
    return [];
  }

  return [
    {
      kind: 'review-comment',
      action,
      pullRequest,
      comment: {
        id,
        url,
        path,
        ...(comment.subject_type === 'file'
          ? { subject: 'file' as const }
          : {
              subject: 'line' as const,
              side:
                comment.side === 'LEFT' ? ('old' as const) : ('new' as const),
              line: at(comment.line) ?? at(comment.original_line),
              startLine:
                at(comment.start_line) ?? at(comment.original_start_line),
            }),
        body:
          typeof comment.body !== 'string'
            ? ''
            : comment.user?.type === 'Bot'
              ? unsigned(comment.body)
              : comment.body,
        answers: at(comment.in_reply_to_id),
        login: text(comment.user?.login),
        writtenAt: writtenAt(comment.created_at),
      },
    },
  ];
};

const defaultBranchPushed = (payload: Payload): Heard[] => {
  const repository = text(payload.repository?.full_name);
  const branch = text(payload.repository?.default_branch);

  if (!repository || !branch || payload.ref !== `refs/heads/${branch}`) {
    return [];
  }

  const paths = [
    ...new Set(
      (payload.commits ?? []).flatMap((commit) =>
        [
          ...(commit.added ?? []),
          ...(commit.removed ?? []),
          ...(commit.modified ?? []),
        ].filter((path): path is string => typeof path === 'string'),
      ),
    ),
  ];

  return paths.length > 0
    ? [{ kind: 'default-branch-pushed', repository, paths }]
    : [];
};

const COMMIT = /^[0-9a-f]{40}$/i;

const pullRequestClosed = (payload: Payload): Heard[] => {
  const pull = payload.pull_request;
  const pullRequest = text(pull?.html_url);
  const repository = text(payload.repository?.full_name);

  if (payload.action !== 'closed' || !pull || !pullRequest || !repository) {
    return [];
  }

  const commit = text(pull.merge_commit_sha);

  if (pull.merged === true && !(commit && COMMIT.test(commit))) {
    return [];
  }

  return [
    {
      kind: 'pull-request-closed',
      pullRequest,
      repository,
      merge: pull.merged === true && commit ? { commit } : null,
      closedAt: writtenAt(pull.closed_at),
    },
  ];
};

const heardIn = (event: string | undefined, payload: Payload): Heard[] => {
  if (event === 'installation') {
    return payload.action === 'deleted'
      ? [{ kind: 'installation-removed' }]
      : [];
  }

  if (event === 'push') {
    return defaultBranchPushed(payload);
  }

  return [
    ...(event === 'pull_request_review_comment' ? reviewComment(payload) : []),
    ...(event === 'pull_request' ? pullRequestClosed(payload) : []),
    ...pullRequestActivity(event, payload),
  ];
};

export class GitHubWebhookTranslation implements WebhookTranslationPort {
  idOf(delivery: GitHubDelivery): string {
    return (
      headed(delivery, 'x-github-delivery') ??
      createHash('sha256')
        .update(delivery.raw ?? Buffer.from(''))
        .digest('hex')
    );
  }

  signatureOf(delivery: GitHubDelivery): string | undefined {
    return headed(delivery, 'x-hub-signature-256');
  }

  translated(delivery: GitHubDelivery): TranslatedDelivery {
    const payload = (delivery.body ?? {}) as Payload;

    return {
      installation: named(payload.installation?.id),
      heard: heardIn(headed(delivery, 'x-github-event'), payload),
    };
  }
}
