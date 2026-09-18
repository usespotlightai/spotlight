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

const RAISED: Readonly<Record<PullRequestActivityKind, HappeningDeclaration>> =
  {
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

const happened = (heard: PullRequestActivity): Happened => {
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
    throw new UpstreamRefusedError(
      `reading a GitHub ${heard.activity} delivery`,
      'it names neither a branch nor a pull request',
    );
  }

  return {
    happening: raising.happening.value,
    told: raising.told,
    spoken: raising.spoken,
    state: 'raised',
    concerns,
    said: heard.remark
      ? {
          body: heard.remark.body,
          path: heard.remark.path,
          from: heard.remark.from,
          to: heard.remark.to,
          remark: heard.remark.id,
        }
      : null,
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

    return this.github.activityIn(delivered).map(happened);
  }
}
