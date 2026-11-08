import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import type { NotificationStreamPort } from '@notifications/application/ports/notification-stream.port';

export class InMemoryNotificationStream implements NotificationStreamPort {
  private readonly watchers = new Map<
    string,
    Set<(notification: NotificationDto) => void>
  >();

  publish(personId: string, notification: NotificationDto): void {
    for (const listener of [...(this.watchers.get(personId) ?? [])]) {
      listener(notification);
    }
  }

  subscribe(
    personId: string,
    listener: (notification: NotificationDto) => void,
  ): () => void {
    const listeners = this.watchers.get(personId) ?? new Set();
    listeners.add(listener);
    this.watchers.set(personId, listeners);

    return () => {
      const attached = this.watchers.get(personId);

      if (!attached) {
        return;
      }

      attached.delete(listener);

      if (attached.size === 0) {
        this.watchers.delete(personId);
      }
    };
  }
}
