import { EditMemoryCommand } from '@memory/application/commands/edit-memory.command';
import { EditMemoryHandler } from '@memory/application/commands/handlers/edit-memory.handler';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { TeamMemoryLoader } from '@memory/application/services/team-memory-loader.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryCreated } from '@memory/domain/events/memory-created.event';
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
const WORKSPACE = WorkspaceId.of('ws_1');
const ADA = UserId.of('user_ada');

const OLD = Memory.write({
  id: MemoryId.of('memory_old'),
  handle: MemoryHandle.of(7),
  workspaceId: WORKSPACE,
  kind: 'preference',
  body: MemoryBody.of('Name branches after people.'),
  scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
  grounds: null,
  by: MemoryDecision.of({ by: ADA, at: NOW }),
});

const editing = (member = true) => {
  const added: Memory[] = [];
  const memories = {
    find: async (id: MemoryId) => (id.equals(OLD.id) ? OLD : null),
    nextHandle: async () => MemoryHandle.of(8),
    add: vi.fn(async (memory: Memory) => {
      added.push(memory);
    }),
    save: vi.fn(),
  };
  const work = {
    linesOf: async () => [],
    reasoning: async () => null,
    spokenOn: async () => null,
  } as unknown as WorkPort;
  const people = {
    memberOf: async () => (member ? { workspaceId: WORKSPACE, by: ADA } : null),
    find: async () => ({ name: 'Ada', image: null }),
  } as unknown as PeoplePort;
  const repository = memories as unknown as MemoryRepository;
  const handler = new EditMemoryHandler(
    new MemoryAccess(people, work),
    new TeamMemoryLoader(repository, work),
    repository,
    new TeamMemoryViews(repository, work, people, {
      runsUsing: async () => new Map(),
    } as unknown as MemoryUsesPort),
    { generate: () => 'memory_new' },
    { now: () => NOW, sleep: async () => undefined },
  );

  return {
    added,
    memories,
    edit: () =>
      handler.execute(
        new EditMemoryCommand('team_1', OLD.id.value, ADA.value, {
          kind: 'preference',
          body: 'Name branches after the ticket.',
          lineId: null,
          stationId: null,
          repository: null,
          paths: [],
        }),
      ),
  };
};

describe('EditMemoryHandler', () => {
  it('makes a successor active to supersede the memory, and lets the successor retire it', async () => {
    const { added, memories, edit } = editing();

    const edited = await edit();

    expect(edited.supersedes).toBe(OLD.id.value);
    expect(memories.save).not.toHaveBeenCalled();
    expect(added).toHaveLength(1);
    expect(added[0]?.pullEvents()).toEqual([
      new MemoryCreated(MemoryId.of('memory_new'), OLD.id),
    ]);
  });

  it('knows no team the viewer is not on', async () => {
    const { edit, memories } = editing(false);

    await expect(edit()).rejects.toMatchObject({
      kind: 'not-found',
      message: 'Team team_1 not found.',
    });
    expect(memories.add).not.toHaveBeenCalled();
  });
});
