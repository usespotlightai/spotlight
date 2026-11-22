import type { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import {
  MEMORIES_USED,
  type MemoriesUsedIntegrationEvent,
} from '@shared-kernel/application/integration-events/memories-used.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const MEMORY_EVENT_MAPPERS = [
  mapping<MemoriesUsed>(
    'memory.used',
    (event): MemoriesUsedIntegrationEvent => ({
      kind: MEMORIES_USED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      taskId: event.taskId?.value ?? null,
      via: event.via,
      memories: event.memories.map((each) => each.value),
    }),
  ),
];
