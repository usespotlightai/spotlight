import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { NoteMemoryUses } from '@memory/application/services/note-memory-uses.service';
import { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoriesUsed } from '@memory/domain/events/memories-used.event';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_ada');
const RUN = {
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
};

const held = (handle: MemoryHandle, stands: boolean, applies: boolean) => {
  const memory = Memory.write({
    id: MemoryId.of(`memory_${handle.number}`),
    handle,
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of('Keep it simple.'),
    scope: MemoryScope.of({
      teamId: TEAM,
      lineId: applies ? 'line_1' : 'line_other',
    }),
    grounds: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

  return stands ? memory : memory.retire({ by: ADA, reason: 'Gone.', at: NOW });
};

const noting = (
  referenced: readonly string[] | null,
  standing: (handle: string) => boolean = () => true,
  applies: (handle: string) => boolean = () => true,
) => {
  const record = vi.fn(async () => undefined);
  const dispatched: DomainEvent[] = [];
  const asked: { teamId: TeamId; handles: string[] }[] = [];
  const service = new NoteMemoryUses(
    new RecordMemoryUses(
      { record } as unknown as MemoryUsesPort,
      {
        dispatch: async (events: readonly DomainEvent[]) => {
          dispatched.push(...events);
        },
      },
      { inTransaction: (work) => work() },
      { now: () => NOW, sleep: async () => undefined },
    ),
    {
      siteOfRun: async () => ({
        teamId: TEAM,
        lineId: 'line_1',
        stationId: 'station_1',
        repositories: [],
      }),
      referencedUnder: async () => referenced,
    } as unknown as WorkPort,
    {
      withHandles: async (teamId: TeamId, handles: MemoryHandle[]) => {
        asked.push({ teamId, handles: handles.map((each) => each.value) });
        return handles.map((each) =>
          held(each, standing(each.value), applies(each.value)),
        );
      },
    } as unknown as MemoryRepository,
  );

  return { record, dispatched, asked, service };
};

describe('NoteMemoryUses, when a run ends', () => {
  it('counts every memory file the run referred to as recalled, looked up within its team', async () => {
    const { record, dispatched, asked, service } = noting([
      '.spotlight/memory/team/M-3.md',
      '.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
    ]);

    await service.runEnded(RUN);

    expect(asked).toEqual([{ teamId: TEAM, handles: ['M-3', 'M-18'] }]);
    expect(dispatched).toEqual([
      new MemoriesUsed(RUN.id, RUN.workspaceId, RUN.taskId, 'recalled', [
        MemoryId.of('memory_3'),
        MemoryId.of('memory_18'),
      ]),
    ]);
    expect(record).toHaveBeenCalledWith(
      RunId.of('run_1'),
      'recalled',
      [MemoryId.of('memory_3'), MemoryId.of('memory_18')],
      NOW,
    );
  });

  it('records nothing when the run read no memory, or kept no journal', async () => {
    for (const referenced of [[], null]) {
      const { record, dispatched, service } = noting(referenced);

      await service.runEnded(RUN);

      expect(record).not.toHaveBeenCalled();
      expect(dispatched).toEqual([]);
    }
  });

  it('never counts a memory that no longer stands, whatever file the run wrote', async () => {
    const { record, service } = noting(
      ['.spotlight/memory/team/M-3.md', '.spotlight/memory/team/M-42.md'],
      (handle) => handle !== 'M-42',
    );

    await service.runEnded(RUN);

    expect(record).toHaveBeenCalledWith(
      RunId.of('run_1'),
      'recalled',
      [MemoryId.of('memory_3')],
      NOW,
    );
  });

  it('never counts a memory that does not apply to the run’s line, station or repositories', async () => {
    const { record, service } = noting(
      ['.spotlight/memory/team/M-3.md', '.spotlight/memory/line/M-8.md'],
      () => true,
      (handle) => handle !== 'M-8',
    );

    await service.runEnded(RUN);

    expect(record).toHaveBeenCalledWith(
      RunId.of('run_1'),
      'recalled',
      [MemoryId.of('memory_3')],
      NOW,
    );
  });
});

describe('NoteMemoryUses, when a run is briefed', () => {
  it('records the memories it was briefed with and says so, also for a run with no task', async () => {
    const { record, dispatched, service } = noting([]);
    const chat = { ...RUN, taskId: null };

    await service.runBriefed(chat, ['memory_1', 'memory_2']);

    expect(record).toHaveBeenCalledWith(
      RUN.id,
      'briefed',
      [MemoryId.of('memory_1'), MemoryId.of('memory_2')],
      NOW,
    );
    expect(dispatched).toEqual([
      new MemoriesUsed(RUN.id, RUN.workspaceId, null, 'briefed', [
        MemoryId.of('memory_1'),
        MemoryId.of('memory_2'),
      ]),
    ]);
  });

  it('records and says nothing when it was briefed with no memory', async () => {
    const { record, dispatched, service } = noting([]);

    await service.runBriefed(RUN, []);

    expect(record).not.toHaveBeenCalled();
    expect(dispatched).toEqual([]);
  });
});
