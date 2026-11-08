import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxArrivals } from '@work/application/services/inbox-arrivals.service';
import type { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import type { NoticeRaised } from '@work/domain/events/notice-raised.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskAssigned } from '@work/domain/events/task-assigned.event';
import type { TaskConversationReopened } from '@work/domain/events/task-conversation-reopened.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';

type InboxChange =
  | TaskAsked
  | TaskFailed
  | TaskMoved
  | TaskAssigned
  | TaskConversationReopened
  | InboxRequestOpened
  | NoticeRaised;

export const inboxArrivalSubscribers = (
  arrivals: InboxArrivals,
): readonly DomainEventSubscriber[] => [
  subscribing<InboxChange>(
    'work.announce-inbox-arrivals',
    [
      'task.asked',
      'task.failed',
      'task.moved',
      'task.assigned',
      'task.conversation-reopened',
      'inbox-request.opened',
      'notice.raised',
    ],
    (event) => arrivals.requested(event.workspaceId),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'work.forget-inbox-watch-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) => arrivals.forget(WorkspaceId.of(event.workspaceId)),
  ),
];
