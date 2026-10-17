import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { withoutSuperseded } from '@memory/domain/services/superseded-memories';
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
const BY = MemoryDecision.of({
  by: UserId.of('user_1'),
  at: new Date('2026-09-27T10:00:00.000Z'),
});

const kept = (id: number) =>
  Memory.write({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(`Memory ${id}.`),
    scope: MemoryScope.of({ teamId: TEAM }),
    grounds: null,
    by: BY,
  });

const correcting = (old: Memory, id: number) =>
  old.correct({
    id: MemoryId.of(`memory_${id}`),
    handle: MemoryHandle.of(id),
    kind: old.kind,
    body: MemoryBody.of(`Memory ${id}.`),
    scope: old.scope,
    by: BY,
  });

describe('withoutSuperseded', () => {
  it('drops a memory whose correction is active beside it', () => {
    const old = kept(1);
    const other = kept(2);
    const correction = correcting(old, 3);

    expect(withoutSuperseded([old, other, correction])).toEqual([
      other,
      correction,
    ]);
  });

  it('drops a memory whose correction is found elsewhere', () => {
    const old = kept(1);
    const other = kept(2);

    expect(withoutSuperseded([old, other], [correcting(old, 3)])).toEqual([
      other,
    ]);
  });

  it('keeps every memory nothing corrects', () => {
    const memories = [kept(1), kept(2)];

    expect(withoutSuperseded(memories, [])).toEqual(memories);
  });
});
