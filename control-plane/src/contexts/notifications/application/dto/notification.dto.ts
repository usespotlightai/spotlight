export interface NotificationDto {
  readonly id: string;
  readonly kind: 'task' | 'notice';
  readonly title: string;
  readonly body: string | null;
  readonly path: string;
  readonly at: string;
}
