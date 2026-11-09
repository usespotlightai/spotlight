import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import type { NotificationStreamPort } from '@notifications/application/ports/notification-stream.port';
import {
  type LiveFeedPort,
  personChannel,
} from '@platform/live/live-feed.port';

export class LiveNotificationStream implements NotificationStreamPort {
  constructor(private readonly feed: LiveFeedPort) {}

  publish(personId: string, notification: NotificationDto): void {
    this.feed.publish(personChannel(personId), {
      type: 'notification',
      data: { ...notification },
    });
  }
}
