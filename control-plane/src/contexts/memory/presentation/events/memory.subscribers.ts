import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { DeleteMemoryDraft } from '@memory/application/services/delete-memory-draft.service';
import type { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import type { RequestMemories } from '@memory/application/services/request-memories.service';
import type { MemoriesProposed } from '@memory/domain/events/memories-proposed.event';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryCreated } from '@memory/domain/events/memory-created.event';
import type { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import {
  RUN_BRIEFED,
  type RunBriefedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-briefed.integration-event';
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
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const memorySubscribers = (
  requesting: RequestMemories,
  deleting: DeleteMemoryDraft,
  reactions: MemoryReactions,
  recording: RecordRunMemoryUses,
): readonly DomainEventSubscriber[] => [
  subscribing<RunBriefedIntegrationEvent>(
    'memory.record-briefed-memories',
    [RUN_BRIEFED],
    (event) =>
      recording.runBriefed(
        {
          id: RunId.of(event.runId),
          workspaceId: WorkspaceId.of(event.workspaceId),
          taskId: event.taskId ? TaskId.of(event.taskId) : null,
        },
        event.memories,
      ),
  ),
  subscribing<MemoriesProposed>(
    'memory.raise-review',
    ['memory-draft.proposed'],
    (event) => reactions.onProposed(event),
  ),
  subscribing<MemoryReviewResolved>(
    'memory.resolve-review',
    ['memory-draft.review-resolved'],
    (event) => reactions.onReviewResolved(event),
  ),
  subscribing<MemoryApproved>(
    'memory.create-approved-memory',
    ['memory-draft.approved'],
    (event) => reactions.onApproved(event),
  ),
  subscribing<MemoryCreated>(
    'memory.retire-superseded-memory',
    ['memory.created'],
    (event) => reactions.onCreated(event),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'memory.record-memories-read',
    [RUN_ENDED],
    (event) =>
      recording.runEnded({
        id: RunId.of(event.runId),
        workspaceId: WorkspaceId.of(event.workspaceId),
        taskId: event.taskId ? TaskId.of(event.taskId) : null,
      }),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'memory.request-memories',
    [RUN_ENDED],
    (event) =>
      event.taskId
        ? requesting.runEnded(TaskId.of(event.taskId), RunId.of(event.runId))
        : Promise.resolve(),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'memory.delete-draft-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.deleteForTask(TaskId.of(event.taskId)),
  ),
];
