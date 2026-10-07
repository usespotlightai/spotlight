import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type { WebhookSignaturePort } from '@github/application/ports/webhook-signature.port';
import type {
  Heard,
  WebhookTranslationPort,
} from '@github/application/ports/webhook-translation.port';
import type { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class GitHubWebhooks implements GitHubWebhooksPort {
  constructor(
    private readonly translation: WebhookTranslationPort,
    private readonly signature: WebhookSignaturePort,
    private readonly connections: GitHubConnectionRepository,
    private readonly events: DomainEventDispatcher,
    private readonly recording: RecordPullRequests,
    private readonly logger: LoggerPort,
  ) {}

  verifies(delivery: GitHubDelivery): boolean {
    return (
      delivery.raw !== null &&
      this.signature.signs(delivery.raw, this.translation.signatureOf(delivery))
    );
  }

  idOf(delivery: GitHubDelivery): string {
    return this.translation.idOf(delivery);
  }

  async workspaceOf(delivery: GitHubDelivery): Promise<WorkspaceId | null> {
    const installation = this.installationIn(delivery);

    return installation ? this.connections.claimantOf(installation) : null;
  }

  activityIn(delivery: GitHubDelivery): readonly PullRequestActivity[] {
    return this.translation
      .translated(delivery)
      .heard.flatMap((each) =>
        each.kind === 'pull-request-activity' ? [each.activity] : [],
      );
  }

  async receive(delivery: GitHubDelivery): Promise<void> {
    const installation = this.installationIn(delivery);
    const heard = this.translation
      .translated(delivery)
      .heard.filter((each) => each.kind !== 'pull-request-activity');

    if (!installation || heard.length === 0) {
      return;
    }

    const failures: unknown[] = [];

    for (const each of heard) {
      try {
        await this.attend(installation, each);
      } catch (error) {
        failures.push(error);
        this.logger.error(
          { err: error, heard: each.kind },
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
    heard: Heard,
  ): Promise<void> {
    const workspaceId = await this.connections.claimantOf(installation);

    if (!workspaceId) {
      return;
    }

    const from = { installation, workspaceId };

    if (heard.kind === 'installation-removed') {
      await this.connections.save(
        (await this.connections.of(workspaceId)).disconnectedFrom(installation),
      );
    }

    if (heard.kind === 'pull-request') {
      await this.recording.described(from, heard.facts);
    }

    if (heard.kind === 'review-comment') {
      await this.events.dispatch([
        new ReviewCommentReceived(
          workspaceId,
          heard.action,
          heard.pullRequest,
          heard.comment,
        ),
      ]);
      await this.recording.commented(from, heard.pullRequest, heard.facts, {
        id: heard.comment.id,
        on: 'line',
        action: heard.action,
        login: heard.comment.login,
        answers: heard.comment.answers,
        byBot: heard.comment.byBot,
      });
    }

    if (heard.kind === 'conversation-comment') {
      await this.recording.commented(from, heard.pullRequest, null, {
        id: heard.comment.id,
        on: 'conversation',
        action: heard.action,
        login: heard.comment.login,
        answers: null,
        byBot: heard.comment.byBot,
      });
    }

    if (heard.kind === 'review-thread') {
      await this.recording.threadResolved(
        from,
        heard.pullRequest,
        heard.facts,
        heard.thread,
      );
    }

    if (heard.kind === 'pull-request-reviewed') {
      await this.events.dispatch([
        new PullRequestReviewed(
          workspaceId,
          heard.pullRequest,
          heard.state,
          heard.login,
          heard.byBot,
          heard.submittedAt,
        ),
      ]);

      if (heard.id !== null) {
        await this.recording.reviewed(from, heard.pullRequest, heard.facts, {
          id: heard.id,
          state: heard.state,
          login: heard.login,
          byBot: heard.byBot,
          at: heard.submittedAt,
        });
      }
    }

    if (heard.kind === 'pull-request-review-dismissed') {
      await this.recording.reviewDismissed(
        from,
        heard.pullRequest,
        heard.facts,
        heard.id,
      );
    }

    if (heard.kind === 'pull-request-closed') {
      await this.events.dispatch([
        new PullRequestClosed(
          workspaceId,
          heard.pullRequest,
          heard.repository,
          heard.merge,
          heard.closedAt,
        ),
      ]);
    }
  }

  private installationIn(delivery: GitHubDelivery): GitHubInstallation | null {
    const installation = this.translation.translated(delivery).installation;

    return installation ? GitHubInstallation.parsed(installation) : null;
  }
}
