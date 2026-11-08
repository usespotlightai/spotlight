import { isOutsideAuthor } from '@github/application/contracts/author-association.contract';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type {
  Delivered,
  HappeningDeclaration,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import {
  type PullRequestActivityFacts,
  type PullRequestHappening,
  PullRequestHappenings,
  type ReportedActivity,
  type ReviewTrigger,
} from '@integrations/domain/services/pull-request-happenings';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  PULL_REQUEST_MARK,
  REVIEW_MARK,
  REVIEW_ROLE,
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

const RAISED: Readonly<Record<ReportedActivity, HappeningDeclaration>> = {
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

const failedChecksOf = (event: PullRequestActivity): Happened['message'] =>
  event.failedChecks.length > 0
    ? { body: `Failed: ${event.failedChecks.join(', ')}.` }
    : null;

const messageOf = (event: PullRequestActivity): Happened['message'] =>
  event.reviewComment
    ? {
        body: event.reviewComment.body,
        path: event.reviewComment.path,
        from: event.reviewComment.from,
        to: event.reviewComment.to,
        reviewComment: event.reviewComment.id,
        pullRequest: event.pullRequest,
      }
    : null;

const factsOf = (event: PullRequestActivity): PullRequestActivityFacts => ({
  activity: event.activity,
  pullRequest: event.pullRequest ? PullRequestUrl.of(event.pullRequest) : null,
  branch: event.branch,
  labelled: event.label !== null && event.label !== '',
  described: event.details !== null,
  body: event.details?.body ?? null,
  comment: event.reviewComment?.body ?? null,
});

type ReviewRequest = Extract<PullRequestHappening, { kind: 'review-request' }>;

const reviewRequested = (
  event: PullRequestActivity,
  happening: ReviewRequest,
  details: NonNullable<PullRequestActivity['details']>,
): Happened => {
  const { trigger } = happening;
  const pullRequest = happening.pullRequest.value;
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];
  const raising = REVIEW_REQUEST_RAISED[trigger];

  return {
    happening: raising.happening.value,
    summary: raising.summary,
    answers: raising.answers,
    state: 'raised',
    correlationKeys: { branch: null, marks },
    message: happening.carriesComment ? messageOf(event) : null,
    ourOwn: event.ignoredAsBot,
    opens: {
      lineRole: REVIEW_ROLE,
      station: null,
      title: details.title,
      description: happening.description,
      assignEmail: null,
      marks,
      review: {
        trigger,
        label: event.label,
        pullRequest,
        author: details.author,
        outside: isOutsideAuthor(details.authorAssociation),
        draft: details.draft,
        branch: event.branch,
      },
    },
  };
};

const reported = (
  event: PullRequestActivity,
  activity: ReportedActivity,
  correlationKeys: Happened['correlationKeys'],
): Happened => {
  const raising = RAISED[activity];

  return {
    happening: raising.happening.value,
    summary: raising.summary,
    answers: raising.answers,
    state: 'raised',
    correlationKeys,
    message: messageOf(event) ?? failedChecksOf(event),
    ourOwn: event.ignoredAsBot,
    opens: null,
    closedPullRequest:
      activity === 'merged' || activity === 'closed-unmerged'
        ? (event.pullRequest ?? null)
        : null,
  };
};

const happenedFrom = (
  event: PullRequestActivity,
  happening: PullRequestHappening,
): Happened | null => {
  if (happening.kind === 'review-request') {
    return event.details
      ? reviewRequested(event, happening, event.details)
      : null;
  }

  const { pullRequest } = happening;

  return reported(
    event,
    happening.activity,
    happening.to === 'its-review' && pullRequest
      ? {
          branch: null,
          marks: [{ kind: REVIEW_MARK, value: pullRequest.value }],
        }
      : {
          branch: happening.branch,
          marks: pullRequest
            ? [{ kind: PULL_REQUEST_MARK, value: pullRequest.value }]
            : [],
        },
  );
};

const happenedIn = (event: PullRequestActivity): readonly Happened[] =>
  PullRequestHappenings.of(factsOf(event)).flatMap((happening) => {
    const happened = happenedFrom(event, happening);

    return happened ? [happened] : [];
  });

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

  async received(delivered: Delivered): Promise<void> {
    await this.github.receive(delivered);
  }

  async read(delivered: Delivered): Promise<readonly Happened[]> {
    return (await this.github.activityIn(delivered)).flatMap(happenedIn);
  }
}
