import { createHash } from 'node:crypto';
import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type {
  PullRequestAbout,
  PullRequestActivity,
  PullRequestActivityKind,
  PullRequestReviewComment,
} from '@github/application/dto/pull-request-activity.dto';
import type {
  Heard,
  TranslatedDelivery,
  WebhookTranslationPort,
} from '@github/application/ports/webhook-translation.port';
import type {
  PullRequestFacts,
  PullRequestSize,
  PullRequestState,
} from '@github/domain/aggregates/pull-request.aggregate';
import { unsigned } from '@github/infrastructure/github/spotlight-signature';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

interface Payload {
  readonly action?: unknown;
  readonly label?: { readonly name?: unknown };
  readonly installation?: { readonly id?: unknown };
  readonly pull_request?: Pull;
  readonly issue?: Described & {
    readonly pull_request?: { readonly html_url?: unknown };
  };
  readonly comment?: CommentPayload & ReviewComment;
  readonly review?: CommentPayload & {
    readonly id?: unknown;
    readonly state?: unknown;
    readonly submitted_at?: unknown;
  };
  readonly thread?: {
    readonly node_id?: unknown;
    readonly comments?: readonly {
      readonly id?: unknown;
      readonly user?: { readonly login?: unknown; readonly type?: unknown };
    }[];
  };
  readonly check_suite?: {
    readonly conclusion?: unknown;
    readonly head_branch?: unknown;
    readonly pull_requests?: readonly { readonly html_url?: unknown }[];
  };
  readonly sender?: { readonly type?: unknown };
  readonly repository?: {
    readonly full_name?: unknown;
  };
}

interface Described {
  readonly title?: unknown;
  readonly body?: unknown;
  readonly draft?: unknown;
  readonly user?: { readonly login?: unknown; readonly type?: unknown };
  readonly author_association?: unknown;
}

interface Pull extends Described {
  readonly number?: unknown;
  readonly state?: unknown;
  readonly merged?: unknown;
  readonly merged_at?: unknown;
  readonly merge_commit_sha?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly closed_at?: unknown;
  readonly html_url?: unknown;
  readonly additions?: unknown;
  readonly deletions?: unknown;
  readonly changed_files?: unknown;
  readonly head?: { readonly ref?: unknown };
}

interface CommentPayload {
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

const THREAD_ACTIONS: ReadonlyMap<unknown, boolean> = new Map([
  ['resolved', true],
  ['unresolved', false],
]);

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

const reviewCommentOf = (
  comment: CommentPayload | undefined,
): PullRequestReviewComment | null =>
  comment && (text(comment.body) || text(comment.path))
    ? {
        body: text(comment.body)?.trim() ?? '',
        path: text(comment.path)?.trim() ?? null,
        from:
          at(comment.start_line) ??
          at(comment.line) ??
          at(comment.original_line),
        to:
          at(comment.start_line) !== null
            ? (at(comment.line) ?? at(comment.original_line))
            : null,
        id: text(comment.node_id),
      }
    : null;

const described = (pull: Described | undefined): PullRequestAbout | null => {
  const title = text(pull?.title);

  return pull && title
    ? {
        title: title.trim(),
        body: text(pull.body)?.trim() ?? null,
        author: text(pull.user?.login),
        authorAssociation: text(pull.author_association),
        draft: pull.draft === true,
      }
    : null;
};

const ASKED_BY_ANYONE: readonly PullRequestActivityKind[] = [
  'opened',
  'labelled',
];

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

  if (event === 'pull_request' && payload.action === 'labeled') {
    return 'labelled';
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
    label:
      activity === 'labelled'
        ? (text(payload.label?.name)?.trim() ?? null)
        : null,
    about: described(payload.pull_request) ?? described(payload.issue),
    reviewComment:
      reviewCommentOf(payload.comment) ?? reviewCommentOf(payload.review),
    byBot: !ASKED_BY_ANYONE.includes(activity) && byBot(payload),
  };

  return [{ kind: 'pull-request-activity', activity: read }];
};

const counted = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;

const sizeOf = (pull: Pull): PullRequestSize | null => {
  const additions = counted(pull.additions);
  const deletions = counted(pull.deletions);
  const changedFiles = counted(pull.changed_files);

  return additions !== null && deletions !== null && changedFiles !== null
    ? { additions, deletions, changedFiles }
    : null;
};

const stateOf = (pull: Pull): PullRequestState => {
  if (pull.merged === true || text(pull.merged_at)) {
    return 'merged';
  }

  return pull.state === 'closed' ? 'closed' : 'open';
};

const factsOf = (payload: Payload): PullRequestFacts | null => {
  const pull = payload.pull_request;
  const html = text(pull?.html_url);
  const fullName = text(payload.repository?.full_name);
  const number = at(pull?.number);
  const title = text(pull?.title);
  const openedAt = writtenAt(pull?.created_at);

  if (!pull || !html || !fullName || !number || !title || !openedAt) {
    return null;
  }

  try {
    const url = PullRequestUrl.of(html);
    const repository = Repository.of(fullName);
    const state = stateOf(pull);

    if (
      url.number !== number ||
      url.repository?.value.toLowerCase() !== repository.value.toLowerCase()
    ) {
      return null;
    }

    return {
      url,
      repository,
      number,
      title: title.trim(),
      body: text(pull.body),
      author: text(pull.user?.login),
      authorIsBot: pull.user?.type === 'Bot',
      branch: text(pull.head?.ref),
      size: sizeOf(pull),
      openedAt,
      draft: pull.draft === true,
      markedReadyAt:
        payload.action === 'ready_for_review'
          ? writtenAt(pull.updated_at)
          : null,
      markedDraftAt:
        payload.action === 'converted_to_draft'
          ? writtenAt(pull.updated_at)
          : null,
      state,
      closedAt:
        state === 'merged'
          ? (writtenAt(pull.merged_at) ?? writtenAt(pull.closed_at))
          : writtenAt(pull.closed_at),
      updatedAt: writtenAt(pull.updated_at),
    };
  } catch {
    return null;
  }
};

const pullRequestDescribed = (payload: Payload): Heard[] => {
  const facts = factsOf(payload);

  return facts ? [{ kind: 'pull-request', facts }] : [];
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
        byBot: comment.user?.type === 'Bot',
        writtenAt: writtenAt(comment.created_at),
      },
      facts: factsOf(payload),
    },
  ];
};

const conversationComment = (payload: Payload): Heard[] => {
  const comment = payload.comment;
  const action = REVIEW_COMMENT_ACTIONS.find((each) => each === payload.action);
  const pullRequest = text(payload.issue?.pull_request?.html_url);
  const id = at(comment?.id);

  if (!comment || !action || !pullRequest || !id) {
    return [];
  }

  return [
    {
      kind: 'conversation-comment',
      action,
      pullRequest,
      comment: {
        id,
        login: text(comment.user?.login),
        byBot: comment.user?.type === 'Bot',
      },
    },
  ];
};

const reviewThread = (payload: Payload): Heard[] => {
  const pullRequest = text(payload.pull_request?.html_url);
  const resolved = THREAD_ACTIONS.get(payload.action);
  const id = text(payload.thread?.node_id);
  const opener = payload.thread?.comments?.[0];

  if (!pullRequest || resolved === undefined || !id) {
    return [];
  }

  return [
    {
      kind: 'review-thread',
      pullRequest,
      thread: {
        id,
        opener: at(opener?.id),
        login: text(opener?.user?.login),
        byBot: opener?.user?.type === 'Bot',
        resolved,
      },
      facts: factsOf(payload),
    },
  ];
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

type ReviewState = 'approved' | 'changes-requested' | 'commented';

const REVIEW_STATES: ReadonlyMap<string, ReviewState> = new Map([
  ['approved', 'approved'],
  ['changes_requested', 'changes-requested'],
  ['commented', 'commented'],
]);

const reviewStateOf = (state: unknown): ReviewState | null =>
  typeof state === 'string'
    ? (REVIEW_STATES.get(state.toLowerCase()) ?? null)
    : null;

const pullRequestReviewed = (payload: Payload): Heard[] => {
  const review = payload.review;
  const pullRequest = text(payload.pull_request?.html_url);
  const state = reviewStateOf(review?.state);

  if (payload.action !== 'submitted' || !review || !pullRequest || !state) {
    return [];
  }

  return [
    {
      kind: 'pull-request-reviewed',
      pullRequest,
      id: at(review.id),
      facts: factsOf(payload),
      state,
      login: text(review.user?.login),
      byBot: review.user?.type === 'Bot',
      submittedAt: writtenAt(review.submitted_at),
    },
  ];
};

const reviewDismissed = (payload: Payload): Heard[] => {
  const pullRequest = text(payload.pull_request?.html_url);
  const id = at(payload.review?.id);

  if (payload.action !== 'dismissed' || !pullRequest || id === null) {
    return [];
  }

  return [
    {
      kind: 'pull-request-review-dismissed',
      pullRequest,
      id,
      facts: factsOf(payload),
    },
  ];
};

const heardIn = (event: string | undefined, payload: Payload): Heard[] => {
  if (event === 'installation') {
    return payload.action === 'deleted'
      ? [{ kind: 'installation-removed' }]
      : [];
  }

  return [
    ...(event === 'pull_request_review_comment' ? reviewComment(payload) : []),
    ...(event === 'issue_comment' ? conversationComment(payload) : []),
    ...(event === 'pull_request_review_thread' ? reviewThread(payload) : []),
    ...(event === 'pull_request' ? pullRequestDescribed(payload) : []),
    ...(event === 'pull_request' ? pullRequestClosed(payload) : []),
    ...(event === 'pull_request_review' ? pullRequestReviewed(payload) : []),
    ...(event === 'pull_request_review' ? reviewDismissed(payload) : []),
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
