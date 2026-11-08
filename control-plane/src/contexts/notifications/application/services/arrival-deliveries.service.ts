import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import type { NotificationStreamPort } from '@notifications/application/ports/notification-stream.port';
import type { WebPushPort } from '@notifications/application/ports/web-push.port';
import { NotificationText } from '@notifications/application/services/notification-text';
import type { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import { PushSubscriptionVersionConflictError } from '@notifications/domain/exceptions/push-subscription-version-conflict.error';
import type { PushSubscriptionRepository } from '@notifications/domain/repositories/push-subscription.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ArrivedItem {
  readonly workspaceId: string;
  readonly personId: string;
  readonly itemId: string;
  readonly itemKind: 'task' | 'notice';
  readonly title: string;
  readonly summary: string | null;
  readonly askedAt: string;
}

const pathOf = (slug: string, item: ArrivedItem): string => {
  const id = encodeURIComponent(item.itemId);

  return item.itemKind === 'notice'
    ? `/w/${encodeURIComponent(slug)}/inbox/notices/${id}`
    : `/w/${encodeURIComponent(slug)}/inbox/${id}`;
};

export class ArrivalDeliveries {
  constructor(
    private readonly stream: NotificationStreamPort,
    private readonly push: WebPushPort,
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly logger: LoggerPort,
  ) {}

  async streamed(item: ArrivedItem): Promise<void> {
    const notification = await this.notificationOf(item);

    if (notification) {
      this.stream.publish(item.personId, notification);
    }
  }

  async pushed(item: ArrivedItem): Promise<void> {
    if (!this.push.publicKey) {
      return;
    }

    const subscriptions = await this.subscriptions.ofPerson(
      UserId.of(item.personId),
    );

    if (subscriptions.length === 0) {
      return;
    }

    const notification = await this.notificationOf(item);

    if (!notification) {
      return;
    }

    const payload = JSON.stringify(notification);
    const failures: unknown[] = [];

    for (const subscription of subscriptions) {
      try {
        await this.pushedTo(subscription, payload, item.personId);
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw failures[0];
    }
  }

  private async pushedTo(
    subscription: PushSubscription,
    payload: string,
    personId: string,
  ): Promise<void> {
    const outcome = await this.push.send(
      {
        endpoint: subscription.endpoint.url,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      payload,
    );

    if (outcome === 'refused') {
      this.logger.error(
        { personId },
        'A push service refused a notification. Check the VAPID settings.',
      );
      return;
    }

    if (outcome === 'gone') {
      this.logger.info({ personId }, 'A push subscription is gone');
      await this.subscriptions.remove(subscription).catch((error: unknown) => {
        if (!(error instanceof PushSubscriptionVersionConflictError)) {
          throw error;
        }
      });
    }
  }

  private async notificationOf(
    item: ArrivedItem,
  ): Promise<NotificationDto | null> {
    const slug = await this.workspaces.slugOf(WorkspaceId.of(item.workspaceId));

    if (!slug) {
      return null;
    }

    const text = NotificationText.of(item.title, item.summary);

    return {
      id: item.itemId,
      kind: item.itemKind,
      title: text.title,
      body: text.body,
      path: pathOf(slug, item),
      at: item.askedAt,
    };
  }
}
