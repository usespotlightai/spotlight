import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryRetired } from '@memory/domain/events/memory-retired.event';
import { MemoryStood } from '@memory/domain/events/memory-stood.event';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const LATER = new Date('2026-09-27T11:00:00.000Z');
const OLD = MemoryId.of('memory_old');
const NEW = MemoryId.of('memory_new');

const stood = (change: { supersedes?: MemoryId | null; kind?: string } = {}) =>
  Memory.stood({
    id: NEW,
    workspaceId: WorkspaceId.of('ws_1'),
    kind: change.kind ?? 'preference',
    body: ' Name branches after the ticket. ',
    scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
    grounds: MemoryGrounds.of({
      taskId: TaskId.of('task_1'),
      runId: RunId.of('run_1'),
      steps: [],
      notes: [2],
    }),
    source: 'person',
    supersedes: change.supersedes ?? null,
    approval: MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
  });

describe('Memory', () => {
  it('stands once approved, saying what it supersedes', () => {
    const memory = stood({ supersedes: OLD });

    expect(memory.standing).toBe('stands');
    expect(memory.body).toBe('Name branches after the ticket.');
    expect(memory.pullEvents()).toEqual([new MemoryStood(NEW, OLD)]);
  });

  it('refuses a kind nobody knows, or superseding itself', () => {
    expect(() => stood({ kind: 'gossip' })).toThrow(InvalidMemoryError);
    expect(() => stood({ supersedes: NEW })).toThrow(InvalidMemoryError);
  });

  it('retires when a newer memory supersedes it, and says by which', () => {
    const memory = stood();
    memory.pullEvents();

    const retired = memory.supersededBy(OLD, LATER);

    expect(retired.standing).toBe('retired');
    expect(retired.retirement).toEqual({ at: LATER, supersededBy: OLD });
    expect(retired.pullEvents()).toEqual([new MemoryRetired(NEW, OLD)]);
  });

  it('retires once', () => {
    const retired = stood().supersededBy(OLD, LATER);

    expect(retired.supersededBy(MemoryId.of('memory_other'), NOW)).toBe(
      retired,
    );
  });
});
