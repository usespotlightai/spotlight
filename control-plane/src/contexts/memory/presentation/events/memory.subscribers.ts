import type { AskForMemories } from '@memory/application/services/ask-for-memories.service';
import type { ForgetMemoryDraft } from '@memory/application/services/forget-memory-draft.service';
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
): readonly DomainEventSubscriber[] => [
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
