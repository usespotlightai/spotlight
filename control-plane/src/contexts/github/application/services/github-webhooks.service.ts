import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type { WebhookSignaturePort } from '@github/application/ports/webhook-signature.port';
import type {
  WebhookEvent,
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
      .events.flatMap((each) =>
        each.kind === 'pull-request-activity' ? [each.activity] : [],
      );
  }

  async receive(delivery: GitHubDelivery): Promise<void> {
    const installation = this.installationIn(delivery);
    const events = this.translation
      .translated(delivery)
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
    const workspaceId = await this.connections.claimantOf(installation);

    if (!workspaceId) {
      return;
    }

    const from = { installation, workspaceId };

    if (event.kind === 'installation-removed') {
      await this.connections.save(
        (await this.connections.of(workspaceId)).disconnectFrom(installation),
      );
    }

    if (event.kind === 'pull-request') {
      await this.recording.described(from, event.facts);
    }

    if (event.kind === 'review-comment') {
      await this.events.dispatch([
        new ReviewCommentReceived(
          workspaceId,
          event.action,
          event.pullRequest,
          event.comment,
        ),
      ]);
      await this.recording.commented(from, event.pullRequest, event.facts, {
        id: event.comment.id,
        on: 'line',
        action: event.action,
        login: event.comment.login,
        answers: event.comment.answers,
        byBot: event.comment.byBot,
      });
    }

    if (event.kind === 'conversation-comment') {
      await this.recording.commented(from, event.pullRequest, null, {
        id: event.comment.id,
        on: 'conversation',
        action: event.action,
        login: event.comment.login,
        answers: null,
        byBot: event.comment.byBot,
      });
    }

    if (event.kind === 'review-thread') {
      await this.recording.threadResolved(
        from,
        event.pullRequest,
        event.facts,
        event.thread,
      );
    }

    if (event.kind === 'pull-request-reviewed') {
      await this.events.dispatch([
        new PullRequestReviewed(
          workspaceId,
          event.pullRequest,
          event.state,
          event.login,
          event.byBot,
          event.submittedAt,
        ),
      ]);

      if (event.id !== null) {
        await this.recording.reviewed(from, event.pullRequest, event.facts, {
          id: event.id,
          state: event.state,
          login: event.login,
          byBot: event.byBot,
          at: event.submittedAt,
        });
      }
    }

    if (event.kind === 'pull-request-review-dismissed') {
      await this.recording.reviewDismissed(
        from,
        event.pullRequest,
        event.facts,
        event.id,
      );
    }

    if (event.kind === 'pull-request-closed') {
      await this.events.dispatch([
        new PullRequestClosed(
          workspaceId,
          event.pullRequest,
          event.repository,
          event.merge,
          event.closedAt,
        ),
      ]);
    }
  }

  private installationIn(delivery: GitHubDelivery): GitHubInstallation | null {
    const installation = this.translation.translated(delivery).installation;

    return installation ? GitHubInstallation.parsed(installation) : null;
  }
}
