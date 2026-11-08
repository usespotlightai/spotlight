import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import type { NotificationStreamPort } from '@notifications/application/ports/notification-stream.port';
import { InMemoryNotificationStream } from '@notifications/infrastructure/streaming/in-memory-notification-stream';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const CHANNEL = 'spotlight-notifications:';

export interface RedisPublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export interface RedisSubscriber {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(
    event: 'message',
    listener: (channel: string, message: string) => void,
  ): unknown;
}

export class RedisNotificationStream implements NotificationStreamPort {
  private readonly local = new InMemoryNotificationStream();
  private readonly watched = new Map<string, number>();

  constructor(
    private readonly publisher: RedisPublisher,
    private readonly subscriber: RedisSubscriber,
    private readonly logger: LoggerPort,
  ) {
    subscriber.on('message', (channel, message) => {
      if (channel.startsWith(CHANNEL)) {
        this.local.publish(
          channel.slice(CHANNEL.length),
          JSON.parse(message) as NotificationDto,
        );
      }
    });
  }

  publish(personId: string, notification: NotificationDto): void {
    this.publisher
      .publish(CHANNEL + personId, JSON.stringify(notification))
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Publishing a notification'),
      );
  }

  subscribe(
    personId: string,
    listener: (notification: NotificationDto) => void,
  ): () => void {
    const unsubscribe = this.local.subscribe(personId, listener);
    const watchers = (this.watched.get(personId) ?? 0) + 1;
    this.watched.set(personId, watchers);

    if (watchers === 1) {
      this.subscriber
        .subscribe(CHANNEL + personId)
        .catch((error: unknown) =>
          this.logger.warn({ err: error }, 'Watching notifications'),
        );
    }

    let attached = true;

    return () => {
      if (!attached) {
        return;
      }

      attached = false;
      unsubscribe();

      const left = (this.watched.get(personId) ?? 1) - 1;

      if (left > 0) {
        this.watched.set(personId, left);
        return;
      }

      this.watched.delete(personId);
      this.subscriber
        .unsubscribe(CHANNEL + personId)
        .catch((error: unknown) =>
          this.logger.warn({ err: error }, 'Unwatching notifications'),
        );
    };
  }
}
