import { MEMORY_EVENT_MAPPERS } from '@memory/application/integration-events/memory.event-mappers';
import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  MEMORY_EVENT_MAPPERS.filter((each) => each.from === event.kind).map((each) =>
    each.map(event, new Date('2026-10-15T10:00:00.000Z')),
  );

describe('what memory tells other contexts', () => {
  it('publishes which memories a run used, and how', () => {
    expect(
      published(
        new MemoriesUsed(
          RunId.of('run_1'),
          WorkspaceId.of('ws_1'),
          TaskId.of('task_1'),
          'recalled',
          [MemoryId.of('memory_1'), MemoryId.of('memory_2')],
        ),
      ),
    ).toEqual([
      {
        kind: 'memory.memories-used.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        way: 'recalled',
        memories: ['memory_1', 'memory_2'],
      },
    ]);
  });

  it('publishes the use of a run with no task, without a task', () => {
    const [event] = published(
      new MemoriesUsed(
        RunId.of('run_chat'),
        WorkspaceId.of('ws_1'),
        null,
        'briefed',
        [MemoryId.of('memory_1')],
      ),
    );

    expect(event).toMatchObject({ runId: 'run_chat', taskId: null });
  });
});
