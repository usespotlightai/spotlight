import type { GitHubDelivery } from '@github/application/dto/github-delivery.dto';
import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import type { WebhookSignaturePort } from '@github/application/ports/webhook-signature.port';
import type {
  Heard,
  WebhookTranslationPort,
} from '@github/application/ports/webhook-translation.port';
import { DefaultBranchPushed } from '@github/domain/events/default-branch-pushed.event';
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

    for (const each of heard) {
      try {
        await this.attend(installation, each);
      } catch (error) {
        this.logger.error(
          { err: error, heard: each.kind },
          'Attending to what a GitHub delivery said about the workspace',
        );
      }
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

    if (heard.kind === 'installation-removed') {
      await this.connections.save(
        (await this.connections.of(workspaceId)).disconnectedFrom(installation),
      );
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
    }

    if (heard.kind === 'default-branch-pushed') {
      await this.events.dispatch([
        new DefaultBranchPushed(workspaceId, heard.repository, heard.paths),
      ]);
    }
  }

  private installationIn(delivery: GitHubDelivery): GitHubInstallation | null {
    const installation = this.translation.translated(delivery).installation;

    return installation ? GitHubInstallation.parsed(installation) : null;
  }
}
