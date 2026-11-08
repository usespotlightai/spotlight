import type {
  ArrivalDeliveries,
  ArrivedItem,
} from '@notifications/application/services/arrival-deliveries.service';
import {
  INBOX_ITEM_ARRIVED,
  type InboxItemArrivedIntegrationEvent,
} from '@shared-kernel/application/integration-events/inbox-item-arrived.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

const arrivedItemOf = (
  event: InboxItemArrivedIntegrationEvent,
): ArrivedItem => ({
  workspaceId: event.workspaceId,
  personId: event.personId,
  itemId: event.itemId,
  itemKind: event.itemKind,
  title: event.title,
  summary: event.summary,
  askedAt: event.askedAt,
});

export const notificationsSubscribers = (
  deliveries: ArrivalDeliveries,
): readonly DomainEventSubscriber[] => [
  subscribing<InboxItemArrivedIntegrationEvent>(
    'notifications.stream-arrived-item',
    [INBOX_ITEM_ARRIVED],
    (event) => deliveries.streamed(arrivedItemOf(event)),
    { callsOut: true },
  ),
  subscribing<InboxItemArrivedIntegrationEvent>(
    'notifications.push-arrived-item',
    [INBOX_ITEM_ARRIVED],
    (event) => deliveries.pushed(arrivedItemOf(event)),
    { callsOut: true },
  ),
];
