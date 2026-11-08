import type { NotificationDto } from '@notifications/application/dto/notification.dto';

export const NOTIFICATION_STREAM = Symbol('NOTIFICATION_STREAM');

export interface NotificationStreamPort {
  publish(personId: string, notification: NotificationDto): void;

  subscribe(
    personId: string,
    listener: (notification: NotificationDto) => void,
  ): () => void;
}
