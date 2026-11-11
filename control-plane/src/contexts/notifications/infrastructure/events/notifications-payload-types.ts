import { ItemArrived } from '@notifications/domain/events/item-arrived.event';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';

export const NOTIFICATIONS_PAYLOAD_TYPES = [
  ItemArrived,
  PushEndpoint,
  PushKeys,
] as const;
