import { MemoryUses } from '@memory/domain/entities/memory-uses.entity';
import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = {
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: null,
};

const USES = MemoryUses.of({
  run: RUN,
  via: 'recalled',
  memories: [MemoryId.of('memory_1'), MemoryId.of('memory_2')],
  at: new Date('2026-09-30T10:00:00.000Z'),
});

describe('MemoryUses', () => {
  it('tells only of the memories the run used for the first time', () => {
    expect(USES?.usedFirst([MemoryId.of('memory_2')])).toEqual(
      new MemoriesUsed(RUN.id, RUN.workspaceId, null, 'recalled', [
        MemoryId.of('memory_2'),
      ]),
    );
  });

  it('tells nothing when the run used every memory before', () => {
    expect(USES?.usedFirst([])).toBeNull();
  });
});
