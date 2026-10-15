import type { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import {
  MEMORIES_USED,
  type MemoriesUsedIntegrationEvent,
} from '@shared-kernel/application/integration-events/memories-used.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const MEMORY_PUBLICATIONS = [
  publishing<MemoriesUsed>(
    'memory.used',
    (event): MemoriesUsedIntegrationEvent => ({
      kind: MEMORIES_USED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      way: event.way,
      memories: event.memories.map((each) => each.value),
    }),
  ),
];
