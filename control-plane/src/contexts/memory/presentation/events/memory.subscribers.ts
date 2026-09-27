import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { AskForMemories } from '@memory/application/services/ask-for-memories.service';
import type { ForgetMemoryDraft } from '@memory/application/services/forget-memory-draft.service';
import type { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryReviewSettled } from '@memory/domain/events/memory-review-settled.event';
import type { MemoryStood } from '@memory/domain/events/memory-stood.event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const memorySubscribers = (
  asking: AskForMemories,
  forgetting: ForgetMemoryDraft,
  reactions: MemoryReactions,
): readonly DomainEventSubscriber[] => [
  subscribing<MemoriesProposed>(
    'memory.raise-review',
    ['memory-draft.proposed'],
    (event) => reactions.onProposed(event),
  ),
  subscribing<MemoryReviewSettled>(
    'memory.settle-review',
    ['memory-draft.review-settled'],
    (event) => reactions.onReviewSettled(event),
  ),
  subscribing<MemoryApproved>(
    'memory.keep-approved-memory',
    ['memory-draft.approved'],
    (event) => reactions.onApproved(event),
  ),
  subscribing<MemoryStood>(
    'memory.retire-superseded-memory',
    ['memory.stood'],
    (event) => reactions.onStood(event),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'memory.ask-for-memories',
    [RUN_ENDED],
    (event) =>
      event.taskId
        ? asking.runEnded(TaskId.of(event.taskId), RunId.of(event.runId))
        : Promise.resolve(),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'memory.forget-draft-of-deleted-task',
    [TASK_DELETED],
    (event) => forgetting.forget(TaskId.of(event.taskId)),
  ),
];
