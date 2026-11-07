import type { MemoryReactions } from '@memory/application/events/handlers/memory-reactions.handler';
import type { DeleteMemoryDraft } from '@memory/application/services/delete-memory-draft.service';
import type { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import type { RecordRunMemoryUses } from '@memory/application/services/record-run-memory-uses.service';
import type { RequestMemories } from '@memory/application/services/request-memories.service';
import type { MemoryApproved } from '@memory/domain/events/memory-approved.event';
import type { MemoryCreated } from '@memory/domain/events/memory-created.event';
import type { MemoryReviewRequested } from '@memory/domain/events/memory-review-requested.event';
import type { MemoryReviewResolved } from '@memory/domain/events/memory-review-resolved.event';
import {
  DISPATCH_BRIEFED,
  type DispatchBriefedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-briefed.integration-event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const memorySubscribers = (
  requesting: RequestMemories,
  deleting: DeleteMemoryDraft,
  deletingMemories: DeleteTeamMemories,
  reactions: MemoryReactions,
  recording: RecordRunMemoryUses,
): readonly DomainEventSubscriber[] => [
  subscribing<DispatchBriefedIntegrationEvent>(
    'memory.record-briefed-memories',
    [DISPATCH_BRIEFED],
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
  subscribing<MemoryReviewRequested>(
    'memory.create-review',
    ['memory-draft.review-requested'],
    (event) => reactions.onReviewRequested(event),
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
  subscribing<DispatchEndedIntegrationEvent>(
    'memory.record-memories-read',
    [DISPATCH_ENDED],
    (event) =>
      recording.runEnded({
        id: RunId.of(event.runId),
        workspaceId: WorkspaceId.of(event.workspaceId),
        taskId: event.taskId ? TaskId.of(event.taskId) : null,
      }),
  ),
  subscribing<DispatchEndedIntegrationEvent>(
    'memory.request-memories',
    [DISPATCH_ENDED],
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
  subscribing<TeamDeletedIntegrationEvent>(
    'memory.delete-memories-of-deleted-team',
    [TEAM_DELETED],
    (event) => deletingMemories.deleteForTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
];
