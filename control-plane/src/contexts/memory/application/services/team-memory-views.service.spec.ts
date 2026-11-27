import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
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

const NOW = new Date('2026-09-27T10:00:00.000Z');
const ADA = UserId.of('user_ada');

const active = () =>
  Memory.write({
    id: MemoryId.of('memory_1'),
    handle: MemoryHandle.of(1),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'environment',
    body: MemoryBody.of('The sandbox has no make.'),
    scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: NOW }),
  });

const views = () =>
  new TeamMemoryViews(
    { find: async () => null } as unknown as MemoryRepository,
    {
      find: async () => ({ name: 'Ada', image: null }),
    } as unknown as PeoplePort,
    { runsUsing: async () => new Map() } as unknown as MemoryUsesPort,
  );

describe('TeamMemoryViews', () => {
  it('says a memory is restorable as the memory decides it', async () => {
    const retired = active().retire({ by: ADA, reason: 'Wrong.', at: NOW });
    const replaced = active().supersedeWith(MemoryId.of('memory_2'), NOW);

    expect((await views().detail(retired)).restorable).toBe(true);
    expect((await views().detail(active())).restorable).toBe(false);
    expect((await views().detail(replaced)).restorable).toBe(false);
  });
});
