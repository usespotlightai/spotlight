import type { ArrivalDeliveries } from '@notifications/application/services/arrival-deliveries.service';
import type { ArrivalRecounts } from '@notifications/application/services/arrival-recounts.service';
import type { ItemArrived } from '@notifications/domain/events/item-arrived.event';
import {
  INBOX_REQUEST_OPENED,
  type InboxRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/inbox-request-opened.integration-event';
import {
  NOTICE_RAISED,
  type NoticeRaisedIntegrationEvent,
} from '@shared-kernel/application/integration-events/notice-raised.integration-event';
import {
  TASK_ASKED,
  type TaskAskedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-asked.integration-event';
import {
  TASK_ASSIGNED,
  type TaskAssignedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-assigned.integration-event';
import {
  TASK_CONVERSATION_REOPENED,
  type TaskConversationReopenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-conversation-reopened.integration-event';
import {
  TASK_FAILED,
  type TaskFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-failed.integration-event';
import {
  TASK_MOVED,
  type TaskMovedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-moved.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

type InboxChange =
  | TaskAskedIntegrationEvent
  | TaskFailedIntegrationEvent
  | TaskMovedIntegrationEvent
  | TaskAssignedIntegrationEvent
  | TaskConversationReopenedIntegrationEvent
  | InboxRequestOpenedIntegrationEvent
  | NoticeRaisedIntegrationEvent;

const arrivedItemOf = (event: ItemArrived) => ({
  workspaceId: event.workspaceId.value,
  personId: event.person.value,
  itemId: event.itemId,
  itemKind: event.itemKind,
  title: event.title,
  summary: event.summary,
  askedAt: event.askedAt.toISOString(),
});

export const notificationsSubscribers = (
  recounts: ArrivalRecounts,
  deliveries: ArrivalDeliveries,
): readonly DomainEventSubscriber[] => [
  subscribing<InboxChange>(
    'notifications.recount-inbox-arrivals',
    [
      TASK_ASKED,
      TASK_FAILED,
      TASK_MOVED,
      TASK_ASSIGNED,
      TASK_CONVERSATION_REOPENED,
      INBOX_REQUEST_OPENED,
      NOTICE_RAISED,
    ],
    (event) => recounts.requested(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'notifications.forget-arrivals-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => recounts.forget(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<ItemArrived>(
    'notifications.stream-arrived-item',
    ['inbox-item.arrived'],
    (event) => deliveries.streamed(arrivedItemOf(event)),
    { callsOut: true },
  ),
  subscribing<ItemArrived>(
    'notifications.push-arrived-item',
    ['inbox-item.arrived'],
    (event) => deliveries.pushed(arrivedItemOf(event)),
    { callsOut: true },
  ),
];
