import { isOutsideAuthor } from '@github/application/contracts/author-association.contract';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type {
  ConflictedPullRequest,
  GitHubHappeningsPort,
} from '@integrations/application/ports/github-happenings.port';
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
import { failedChecksMessage } from '@integrations/infrastructure/webhooks/failed-checks.message';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
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
  conflicted: raised({
    key: 'github.pull_request.conflicted',
    label: 'Pull request conflicts',
    summary: 'The pull request conflicts with its base branch.',
  }),
};

const failedChecksOf = (event: PullRequestActivity): Happened['message'] => {
  const body = failedChecksMessage(event.failedChecks);

  return nonEmpty(body) ? { body } : null;
};

const conflictOf = (conflict: ConflictedPullRequest): Happened['message'] => ({
  body: `The pull request conflicts with ${conflict.base}. Rebase the branch on ${conflict.base} and push it.`,
});

const messageOf = (
  event: PullRequestActivity,
  verdict: string | null = null,
): Happened['message'] =>
  event.reviewComment
    ? {
        body: [verdict, event.reviewComment.body].filter(Boolean).join('\n\n'),
        path: event.reviewComment.path,
        from: event.reviewComment.from,
        to: event.reviewComment.to,
        reviewComment: event.reviewComment.id,
        pullRequest: event.pullRequest,
      }
    : null;

const factsOf = (event: PullRequestActivity): PullRequestActivityFacts => ({
  activity: event.activity,
  pullRequest: nonEmpty(event.pullRequest)
    ? PullRequestUrl.of(event.pullRequest)
    : null,
  branch: event.branch,
  labelled: nonEmpty(event.label),
  described: event.details !== null,
  body: event.details?.body ?? null,
  comment: event.reviewComment?.body ?? null,
});

type ReviewRequest = Extract<PullRequestHappening, { kind: 'review-request' }>;

type ReportedHappening = Extract<PullRequestHappening, { kind: 'activity' }>;

interface Report {
  readonly message: Happened['message'];
  readonly ourOwn: boolean;
  readonly closedPullRequest: string | null;
}

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
        ...(details.merged ? { merged: true } : {}),
        branch: event.branch,
      },
    },
  };
};

const correlationOf = (
  happening: ReportedHappening,
): Happened['correlationKeys'] => {
  const { pullRequest } = happening;

  return happening.to === 'its-review' && pullRequest
    ? {
        branch: null,
        marks: [{ kind: REVIEW_MARK, value: pullRequest.value }],
      }
    : {
        branch: happening.branch,
        marks: pullRequest
          ? [{ kind: PULL_REQUEST_MARK, value: pullRequest.value }]
          : [],
      };
};

const reported = (
  activity: ReportedActivity,
  correlationKeys: Happened['correlationKeys'],
  report: Report,
): Happened => {
  const raising = RAISED[activity];

  return {
    happening: raising.happening.value,
    summary: raising.summary,
    answers: raising.answers,
    state: 'raised',
    correlationKeys,
    message: report.message,
    ourOwn: report.ourOwn,
    opens: null,
    closedPullRequest: report.closedPullRequest,
    closedUnmerged: activity === 'closed-unmerged',
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

  const { activity } = happening;

  return reported(activity, correlationOf(happening), {
    message:
      messageOf(
        event,
        happening.statesVerdict ? RAISED[activity].summary : null,
      ) ?? failedChecksOf(event),
    ourOwn: event.ignoredAsBot,
    closedPullRequest:
      activity === 'merged' || activity === 'closed-unmerged'
        ? (event.pullRequest ?? null)
        : null,
  });
};

const happenedIn = (event: PullRequestActivity): readonly Happened[] =>
  PullRequestHappenings.of(factsOf(event)).flatMap((happening) => {
    const happened = happenedFrom(event, happening);

    return happened ? [happened] : [];
  });

export class GitHubWebhookProvider
  implements WebhookProviderPort, GitHubHappeningsPort
{
  readonly key = 'github';

  readonly happenings: readonly HappeningDeclaration[] = [
    RAISED.merged,
    RAISED.commented,
    RAISED['changes-requested'],
    RAISED['checks-failed'],
    RAISED['closed-unmerged'],
    RAISED.conflicted,
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

  conflicted(conflict: ConflictedPullRequest): readonly Happened[] {
    return PullRequestHappenings.of({
      activity: 'conflicted',
      pullRequest: PullRequestUrl.of(conflict.pullRequest),
      branch: conflict.branch,
      labelled: false,
      described: false,
      body: null,
      comment: null,
    }).flatMap((happening) =>
      happening.kind === 'activity'
        ? [
            reported(happening.activity, correlationOf(happening), {
              message: conflictOf(conflict),
              ourOwn: false,
              closedPullRequest: null,
            }),
          ]
        : [],
    );
  }
}
