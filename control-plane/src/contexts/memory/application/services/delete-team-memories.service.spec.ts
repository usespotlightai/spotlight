import { DeleteTeamMemories } from '@memory/application/services/delete-team-memories.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryVersionConflictError } from '@memory/domain/exceptions/memory-version-conflict.error';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const memoryOf = (id: number): Memory =>
  Memory.write({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${id}.`),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });

const deleting = (
  changedMeanwhile: Set<string>,
  addedMeanwhile: Memory | null = null,
) => {
  let toAdd = addedMeanwhile;
  const stored = new Map(
    [1, 2, 3].map((id) => [memoryOf(id).id.value, memoryOf(id)] as const),
  );
  let transactions = 0;
  const removed: string[] = [];
  const upkeepsLeft = ['upkeep_1', 'upkeep_2'];
  let scheduleLeft = true;
  const upkeeps = {
    ofTeam: async () => upkeepsLeft.map((id) => ({ id })),
    remove: async (upkeep: { id: string }) => {
      removed.push(upkeep.id);
      upkeepsLeft.splice(upkeepsLeft.indexOf(upkeep.id), 1);
    },
  } as unknown as MemoryUpkeepRepository;
  const schedules = {
    ofTeam: async () => (scheduleLeft ? { id: 'schedule' } : null),
    remove: async (schedule: { id: string }) => {
      removed.push(schedule.id);
      scheduleLeft = false;
    },
  } as unknown as MemoryUpkeepScheduleRepository;
  const memories = {
    ofTeam: async () => [...stored.values()],
    save: async (memory: Memory) => {
      if (!memory.isDeleted || changedMeanwhile.has(memory.id.value)) {
        throw new MemoryVersionConflictError(memory.id.value);
      }
      stored.delete(memory.id.value);
      if (toAdd) {
        stored.set(toAdd.id.value, toAdd);
        toAdd = null;
      }
    },
  } as unknown as MemoryRepository;
  const service = new DeleteTeamMemories(
    memories,
    {
      inTransaction: <T>(work: () => Promise<T>) => {
        transactions += 1;
        return work();
      },
    },
    upkeeps,
    schedules,
  );

  return { service, stored, removed, transactions: () => transactions };
};

describe('DeleteTeamMemories', () => {
  it('removes the schedule and each upkeep, then each memory of the team, in a transaction each', async () => {
    const { service, stored, removed, transactions } = deleting(new Set());

    await service.deleteForTeam(TEAM);

    expect(stored.size).toBe(0);
    expect(transactions()).toBe(7);
    expect(removed).toEqual(['schedule', 'upkeep_1', 'upkeep_2']);
  });

  it('keeps the memories it removed when another changed meanwhile, and a retry removes the rest', async () => {
    const changedMeanwhile = new Set(['memory_2']);
    const { service, stored } = deleting(changedMeanwhile);

    await expect(service.deleteForTeam(TEAM)).rejects.toBeInstanceOf(
      MemoryVersionConflictError,
    );
    expect([...stored.keys()]).toEqual(['memory_2', 'memory_3']);

    changedMeanwhile.clear();
    await service.deleteForTeam(TEAM);

    expect(stored.size).toBe(0);
  });

  it('also removes a memory added to the team while it deletes', async () => {
    const { service, stored } = deleting(new Set(), memoryOf(4));

    await service.deleteForTeam(TEAM);

    expect(stored.size).toBe(0);
  });
});
