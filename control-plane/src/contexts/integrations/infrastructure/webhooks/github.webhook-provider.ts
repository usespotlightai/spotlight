import { AuthorAssociation } from '@github/application/contracts/author-association.contract';
import type {
  PullRequestActivity,
  PullRequestActivityKind,
} from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type {
  Delivered,
  HappeningDeclaration,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { WebhookProvider } from '@integrations/infrastructure/webhooks/webhook-provider.decorator';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  PULL_REQUEST_MARK,
  REVIEW_MARK,
  REVIEW_ROLE,
  type ReviewTrigger,
} from '@work/application/contracts/happenings.contract';

const raised = (input: {
  key: string;
  label: string;
  summary: string;
  answers?: boolean;
}): HappeningDeclaration => ({
  happening: HappeningName.of(input.key),
  label: input.label,
  summary: input.summary,
  answers: input.answers ?? false,
});

const REVIEW_REQUEST_RAISED: Readonly<
  Record<ReviewTrigger, HappeningDeclaration>
> = {
  opened: raised({
    key: 'github.pull_request.opened',
    label: 'Pull request opened',
    summary: 'A pull request was opened for review.',
  }),
  mentioned: raised({
    key: 'github.pull_request.mentioned',
    label: 'Mentioned on a pull request',
    summary: 'Somebody mentioned Spotlight on the pull request.',
    answers: true,
  }),
  labelled: raised({
    key: 'github.pull_request.labelled',
    label: 'Labelled on a pull request',
    summary: 'Somebody labelled the pull request for Spotlight.',
  }),
};

type ReviewRequestKind = Extract<
  PullRequestActivityKind,
  'opened' | 'labelled'
>;

const RAISED: Readonly<
  Record<
    Exclude<PullRequestActivityKind, ReviewRequestKind>,
    HappeningDeclaration
  >
> = {
  merged: raised({
    key: 'github.pull_request.merged',
    label: 'Pull request merged',
    summary: 'The pull request was merged.',
  }),
  commented: raised({
    key: 'github.pull_request.commented',
    label: 'Pull request commented on',
    summary: 'The pull request was commented on.',
    answers: true,
  }),
  'changes-requested': raised({
    key: 'github.pull_request.changes-requested',
    label: 'Changes requested',
    summary: 'Changes were requested on the pull request.',
    answers: true,
  }),
  'checks-failed': raised({
    key: 'github.checks.failed',
    label: 'Checks failed',
    summary: 'The checks failed on the pull request.',
  }),
  'closed-unmerged': raised({
    key: 'github.pull_request.closed-unmerged',
    label: 'Pull request closed unmerged',
    summary: 'The pull request was closed without being merged.',
  }),
};

const failUnnamed = (event: PullRequestActivity): never => {
  throw new UpstreamError(
    `reading a GitHub ${event.activity} delivery`,
    'it names neither a branch nor a pull request',
  );
};

const messageOf = (event: PullRequestActivity): Happened['message'] =>
  event.reviewComment
    ? {
        body: event.reviewComment.body,
        path: event.reviewComment.path,
        from: event.reviewComment.from,
        to: event.reviewComment.to,
        reviewComment: event.reviewComment.id,
      }
    : null;

const describedFor = (pullRequest: string, body: string | null): string =>
  [`Review ${pullRequest}`, body ?? ''].filter(Boolean).join('\n\n');

const reviewRequestFor = (
  event: PullRequestActivity,
  trigger: ReviewTrigger,
): Happened | null => {
  if (!event.pullRequest || !event.details) {
    return null;
  }

  const pullRequest = PullRequestUrl.of(event.pullRequest).value;
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];
  const raising = REVIEW_REQUEST_RAISED[trigger];

  return {
    happening: raising.happening.value,
    summary: raising.summary,
    answers: raising.answers,
    state: 'raised',
    concerns: { branch: null, marks },
    message: trigger === 'mentioned' ? messageOf(event) : null,
    ourOwn: event.byBot,
    opens: {
      lineRole: REVIEW_ROLE,
      station: null,
      title: event.details.title,
      description: describedFor(pullRequest, event.details.body),
      assignEmail: null,
      marks,
      review: {
        trigger,
        label: event.label,
        pullRequest,
        author: event.details.author,
        outside: AuthorAssociation.of(event.details.authorAssociation)
          .isOutside,
        draft: event.details.draft,
        branch: event.branch,
      },
    },
  };
};

const mentions = (event: PullRequestActivity): boolean =>
  (event.activity === 'commented' || event.activity === 'changes-requested') &&
  (event.reviewComment?.body.includes('@') ?? false);

const happenedIn = (event: PullRequestActivity): readonly Happened[] => {
  if (event.activity === 'opened') {
    if (!event.pullRequest) {
      failUnnamed(event);
    }

    const reviewRequest = reviewRequestFor(event, 'opened');

    return reviewRequest ? [reviewRequest] : [];
  }

  if (event.activity === 'labelled') {
    const reviewRequest = event.label
      ? reviewRequestFor(event, 'labelled')
      : null;

    return reviewRequest ? [reviewRequest] : [];
  }

  const mentioned = mentions(event)
    ? reviewRequestFor(event, 'mentioned')
    : null;
  const payload = happened({ ...event, activity: event.activity });

  return [
    payload,
    ...(event.pullRequest ? [toItsReview(payload, event.pullRequest)] : []),
    ...(mentioned ? [mentioned] : []),
  ];
};

// The task that opened a pull request and the task that reviews it each receive the word through their own mark.
const toItsReview = (payload: Happened, pullRequest: string): Happened => ({
  ...payload,
  concerns: {
    branch: null,
    marks: [{ kind: REVIEW_MARK, value: PullRequestUrl.of(pullRequest).value }],
  },
});

const happened = (
  event: PullRequestActivity & {
    activity: Exclude<PullRequestActivityKind, ReviewRequestKind>;
  },
): Happened => {
  const raising = RAISED[event.activity];
  const concerns = {
    branch: event.branch,
    marks: event.pullRequest
      ? [
          {
            kind: PULL_REQUEST_MARK,
            value: PullRequestUrl.of(event.pullRequest).value,
          },
        ]
      : [],
  };

  if (!concerns.branch && concerns.marks.length === 0) {
    failUnnamed(event);
  }

  return {
    happening: raising.happening.value,
    summary: raising.summary,
    answers: raising.answers,
    state: 'raised',
    concerns,
    message: messageOf(event),
    ourOwn: event.byBot,
    opens: null,
  };
};

@WebhookProvider()
export class GitHubWebhookProvider implements WebhookProviderPort {
  readonly key = 'github';

  readonly happenings: readonly HappeningDeclaration[] = [
    RAISED.merged,
    RAISED.commented,
    RAISED['changes-requested'],
    RAISED['checks-failed'],
    RAISED['closed-unmerged'],
    REVIEW_REQUEST_RAISED.opened,
    REVIEW_REQUEST_RAISED.mentioned,
    REVIEW_REQUEST_RAISED.labelled,
  ];

  constructor(private readonly github: GitHubWebhooksPort) {}

  async verifies(delivered: Delivered): Promise<boolean> {
    return this.github.verifies(delivered);
  }

  delivery(delivered: Delivered): string {
    return this.github.idOf(delivered);
  }

  routes(delivered: Delivered): Promise<WorkspaceId | null> {
    return this.github.workspaceOf(delivered);
  }

  async read(delivered: Delivered): Promise<readonly Happened[]> {
    await this.github.receive(delivered);

    return this.github.activityIn(delivered).flatMap(happenedIn);
  }
}
