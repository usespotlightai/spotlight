import { AuthorAssociation } from '@github/application/contracts/author-association.contract';
import type {
  PullRequestActivity,
  PullRequestActivityKind,
} from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type {
  Delivered,
  HappeningDeclaration,
  WebhookSourcePort,
} from '@integrations/application/ports/webhook-source.port';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { WebhookSource } from '@integrations/infrastructure/webhooks/webhook-source.decorator';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  PULL_REQUEST_MARK,
  REVIEW_MARK,
  REVIEW_ROLE,
  type ReviewAsking,
} from '@work/application/contracts/happenings.contract';

const raised = (input: {
  key: string;
  label: string;
  told: string;
  spoken?: boolean;
}): HappeningDeclaration => ({
  happening: HappeningName.of(input.key),
  label: input.label,
  told: input.told,
  spoken: input.spoken ?? false,
});

const ASKED: Readonly<Record<ReviewAsking, HappeningDeclaration>> = {
  opened: raised({
    key: 'github.pull_request.opened',
    label: 'Pull request opened',
    told: 'A pull request was opened for review.',
  }),
  mentioned: raised({
    key: 'github.pull_request.mentioned',
    label: 'Mentioned on a pull request',
    told: 'Somebody mentioned Spotlight on the pull request.',
    spoken: true,
  }),
};

const RAISED: Readonly<
  Record<Exclude<PullRequestActivityKind, 'opened'>, HappeningDeclaration>
> = {
  merged: raised({
    key: 'github.pull_request.merged',
    label: 'Pull request merged',
    told: 'The pull request was merged.',
  }),
  commented: raised({
    key: 'github.pull_request.commented',
    label: 'Pull request commented on',
    told: 'The pull request was commented on.',
    spoken: true,
  }),
  'changes-requested': raised({
    key: 'github.pull_request.changes-requested',
    label: 'Changes requested',
    told: 'Changes were requested on the pull request.',
    spoken: true,
  }),
  'checks-failed': raised({
    key: 'github.checks.failed',
    label: 'Checks failed',
    told: 'The checks failed on the pull request.',
  }),
  'closed-unmerged': raised({
    key: 'github.pull_request.closed-unmerged',
    label: 'Pull request closed unmerged',
    told: 'The pull request was closed without being merged.',
  }),
};

const refusedUnnamed = (heard: PullRequestActivity): never => {
  throw new UpstreamRefusedError(
    `reading a GitHub ${heard.activity} delivery`,
    'it names neither a branch nor a pull request',
  );
};

const saidIn = (heard: PullRequestActivity): Happened['said'] =>
  heard.remark
    ? {
        body: heard.remark.body,
        path: heard.remark.path,
        from: heard.remark.from,
        to: heard.remark.to,
        remark: heard.remark.id,
      }
    : null;

const describedFor = (pullRequest: string, body: string | null): string =>
  [`Review ${pullRequest}`, body ?? ''].filter(Boolean).join('\n\n');

const askedFor = (
  heard: PullRequestActivity,
  asking: ReviewAsking,
): Happened | null => {
  if (!heard.pullRequest || !heard.about) {
    return null;
  }

  const pullRequest = PullRequestUrl.of(heard.pullRequest).value;
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];
  const raising = ASKED[asking];

  return {
    happening: raising.happening.value,
    told: raising.told,
    spoken: raising.spoken,
    state: 'raised',
    concerns: { branch: null, marks },
    said: asking === 'mentioned' ? saidIn(heard) : null,
    ourOwn: heard.byBot,
    opens: {
      onto: REVIEW_ROLE,
      at: null,
      title: heard.about.title,
      description: describedFor(pullRequest, heard.about.body),
      assignEmail: null,
      marks,
      review: {
        asking,
        pullRequest,
        author: heard.about.author,
        outside: AuthorAssociation.of(heard.about.authorAssociation).isOutside,
        draft: heard.about.draft,
        branch: heard.branch,
      },
    },
  };
};

const mentions = (heard: PullRequestActivity): boolean =>
  (heard.activity === 'commented' || heard.activity === 'changes-requested') &&
  (heard.remark?.body.includes('@') ?? false);

const happenedIn = (heard: PullRequestActivity): readonly Happened[] => {
  if (heard.activity === 'opened') {
    if (!heard.pullRequest) {
      refusedUnnamed(heard);
    }

    const asked = askedFor(heard, 'opened');

    return asked ? [asked] : [];
  }

  const mentioned = mentions(heard) ? askedFor(heard, 'mentioned') : null;
  const word = happened({ ...heard, activity: heard.activity });

  return [
    word,
    ...(heard.pullRequest ? [toItsReview(word, heard.pullRequest)] : []),
    ...(mentioned ? [mentioned] : []),
  ];
};

// The task that opened a pull request and the task reviewing it each hear the word, by their own mark.
const toItsReview = (word: Happened, pullRequest: string): Happened => ({
  ...word,
  concerns: {
    branch: null,
    marks: [{ kind: REVIEW_MARK, value: PullRequestUrl.of(pullRequest).value }],
  },
});

const happened = (
  heard: PullRequestActivity & {
    activity: Exclude<PullRequestActivityKind, 'opened'>;
  },
): Happened => {
  const raising = RAISED[heard.activity];
  const concerns = {
    branch: heard.branch,
    marks: heard.pullRequest
      ? [
          {
            kind: PULL_REQUEST_MARK,
            value: PullRequestUrl.of(heard.pullRequest).value,
          },
        ]
      : [],
  };

  if (!concerns.branch && concerns.marks.length === 0) {
    refusedUnnamed(heard);
  }

  return {
    happening: raising.happening.value,
    told: raising.told,
    spoken: raising.spoken,
    state: 'raised',
    concerns,
    said: saidIn(heard),
    ourOwn: heard.byBot,
    opens: null,
  };
};

@WebhookSource()
export class GitHubSource implements WebhookSourcePort {
  readonly key = 'github';

  readonly happenings: readonly HappeningDeclaration[] = [
    RAISED.merged,
    RAISED.commented,
    RAISED['changes-requested'],
    RAISED['checks-failed'],
    RAISED['closed-unmerged'],
    ASKED.opened,
    ASKED.mentioned,
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
