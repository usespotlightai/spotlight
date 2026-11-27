import { RestoreTeamMemoryHandler } from '@memory/application/commands/handlers/restore-team-memory.handler';
import { RestoreTeamMemoryCommand } from '@memory/application/commands/restore-team-memory.command';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryRestored } from '@memory/domain/events/memory-restored.event';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_ada');

const active = () =>
  Memory.write({
    id: MemoryId.of('memory_2'),
    handle: MemoryHandle.of(2),
    workspaceId: WORKSPACE,
    kind: 'environment',
    body: MemoryBody.of('The sandbox has no make.'),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

const retired = () => {
  const memory = active().retire({ by: ADA, reason: 'Wrong.', at: NOW });
  memory.pullEvents();
  return memory;
};

const restoring = (known: Memory) => {
  const saved: Memory[] = [];
  const memories = {
    find: async (id: MemoryId) => (id.equals(known.id) ? known : null),
    save: vi.fn(async (memory: Memory) => {
      saved.push(memory);
    }),
  };
  const people = {
    viewerOf: async () => ({ workspaceId: WORKSPACE, by: ADA }),
  } as unknown as PeoplePort;
  const repository = memories as unknown as MemoryRepository;
  const handler = new RestoreTeamMemoryHandler(
    new MemoryAccess(people, {} as WorkPort),
    new TeamMemoryLoader(repository, { ofTeam: async () => [] }),
    repository,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { now: () => LATER, sleep: async () => undefined },
  );

  return {
    saved,
    memories,
    restore: () =>
      handler.execute(
        new RestoreTeamMemoryCommand('team_1', 'memory_2', ADA.value),
      ),
  };
};

describe('RestoreTeamMemoryHandler', () => {
  it('makes a retired memory active again and records who restored it', async () => {
    const { saved, restore } = restoring(retired());

    await restore();

    expect(saved[0]?.status).toBe('active');
    expect(saved[0]?.pullEvents()).toEqual([
      new MemoryRestored(MemoryId.of('memory_2'), TEAM, ADA, LATER),
    ]);
  });

  it('refuses a memory that is not retired', async () => {
    const { memories, restore } = restoring(active());

    await expect(restore()).rejects.toMatchObject({
      kind: 'conflict',
      message: 'Memory memory_2 is not retired.',
    });
    expect(memories.save).not.toHaveBeenCalled();
  });
});
