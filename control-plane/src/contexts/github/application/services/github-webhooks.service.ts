import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { CheckRunsPort } from '@github/application/ports/check-runs.port';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type {
  WebhookEvent,
  WebhookParserPort,
} from '@github/application/ports/webhook-parser.port';
import type { WebhookSignaturePort } from '@github/application/ports/webhook-signature.port';
import type { PullRequestSync } from '@github/application/services/pull-request-sync.service';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { PullRequestReview } from '@github/domain/value-objects/pull-request-review.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class GitHubWebhooks implements GitHubWebhooksPort {
  constructor(
    private readonly parser: WebhookParserPort,
    private readonly signature: WebhookSignaturePort,
    private readonly connections: GitHubConnectionRepository,
    private readonly sync: PullRequestSync,
    private readonly logger: LoggerPort,
    private readonly checkRuns: CheckRunsPort,
  ) {}

  verifies(delivery: GitHubDelivery): boolean {
    return (
      delivery.raw !== null &&
      this.signature.signs(delivery.raw, this.parser.signatureOf(delivery))
    );
  }

  idOf(delivery: GitHubDelivery): string {
    return this.parser.idOf(delivery);
  }

  async workspaceOf(delivery: GitHubDelivery): Promise<WorkspaceId | null> {
    const installation = this.installationIn(delivery);

    return installation
      ? this.connections.connectedWorkspaceOf(installation)
      : null;
  }

  async activityIn(
    delivery: GitHubDelivery,
  ): Promise<readonly PullRequestActivity[]> {
    const activities = this.parser
      .parse(delivery)
      .events.flatMap((each) =>
        each.kind === 'pull-request-activity' ? [each.activity] : [],
      );

    return Promise.all(
      activities.map((activity) => this.withFailedChecks(delivery, activity)),
    );
  }

  private async withFailedChecks(
    delivery: GitHubDelivery,
    activity: PullRequestActivity,
  ): Promise<PullRequestActivity> {
    const suite = activity.checkSuite;

    if (activity.activity !== 'checks-failed' || !suite) {
      return activity;
    }

    try {
      const workspaceId = await this.workspaceOf(delivery);

      return workspaceId
        ? {
            ...activity,
            failedChecks: (
              await this.checkRuns.failedInSuite(
                workspaceId,
                Repository.of(suite.repository),
                suite.id,
              )
            ).map(({ name, step, summary, log }) => ({
              name,
              step,
              summary,
              log,
            })),
          }
        : activity;
    } catch (error) {
      this.logger.warn(
        {
          suite: suite.id,
          repository: suite.repository,
          reason: error instanceof Error ? error.message : String(error),
        },
        'Could not read the failed checks of a check suite',
      );

      return activity;
    }
  }

  async receive(delivery: GitHubDelivery): Promise<void> {
    const installation = this.installationIn(delivery);
    const events = this.parser
      .parse(delivery)
      .events.filter((each) => each.kind !== 'pull-request-activity');

    if (!installation || events.length === 0) {
      return;
    }

    const failures: unknown[] = [];

    for (const each of events) {
      try {
        await this.attend(installation, each);
      } catch (error) {
        failures.push(error);
        this.logger.error(
          { err: error, event: each.kind },
          'Attending to what a GitHub delivery said about the workspace',
        );
      }
    }

    if (failures.length > 0) {
      throw failures[0];
    }
  }

  private async attend(
    installation: GitHubInstallation,
    event: WebhookEvent,
  ): Promise<void> {
    const workspaceId =
      await this.connections.connectedWorkspaceOf(installation);

    if (!workspaceId) {
      this.logger.info(
        {
          installation: installation.value,
          event: event.kind,
          reason: 'installation-not-connected',
        },
        'Ignored a GitHub event',
      );
      return;
    }

    const from = { installation, workspaceId };

    if (event.kind === 'installation-removed') {
      await this.connections.save(
        (await this.connections.of(workspaceId)).disconnectFrom(installation),
      );
    }

    if (event.kind === 'pull-request') {
      await this.sync.updateDetails(from, event.snapshot);
    }

    if (event.kind === 'review-comment') {
      const { id, inReplyToId, login, byBot, ...details } = event.comment;

      await this.sync.commented(from, event.pullRequest, event.snapshot, {
        id,
        on: 'line',
        action: event.action,
        login,
        inReplyToId,
        byBot,
        details,
      });
    }

    if (event.kind === 'conversation-comment') {
      await this.sync.commented(from, event.pullRequest, null, {
        id: event.comment.id,
        on: 'conversation',
        action: event.action,
        login: event.comment.login,
        inReplyToId: null,
        byBot: event.comment.byBot,
        details: null,
      });
    }

    if (event.kind === 'review-thread') {
      await this.sync.threadResolved(
        from,
        event.pullRequest,
        event.snapshot,
        event.thread,
      );
    }

    if (event.kind === 'pull-request-reviewed' && event.id !== null) {
      await this.sync.reviewed(
        from,
        event.pullRequest,
        event.snapshot,
        PullRequestReview.of({
          id: event.id,
          state: event.state,
          login: event.login,
          byBot: event.byBot,
          at: event.submittedAt,
        }),
      );
    }

    if (event.kind === 'pull-request-review-dismissed') {
      await this.sync.reviewDismissed(
        from,
        event.pullRequest,
        event.snapshot,
        event.id,
      );
    }

    if (event.kind === 'pull-request-closed') {
      await this.sync.closed(from, event.pullRequest, {
        repository: Repository.of(event.repository),
        gitHubId: event.gitHubId,
        merge: event.merge,
        closedAt: event.closedAt,
      });
    }

    if (event.kind === 'pull-request-reopened') {
      await this.sync.reopened(from, event.pullRequest, {
        repository: Repository.of(event.repository),
        gitHubId: event.gitHubId,
        reopenedAt: event.reopenedAt,
      });
    }
  }

  private installationIn(delivery: GitHubDelivery): GitHubInstallation | null {
    const installation = this.parser.parse(delivery).installation;

    return installation ? GitHubInstallation.parsed(installation) : null;
  }
}
