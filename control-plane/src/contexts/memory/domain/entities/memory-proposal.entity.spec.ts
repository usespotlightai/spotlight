import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const DECIDED = MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW });

const stored = (
  state: 'proposed' | 'approved' | 'lapsed',
  retires: { memory: MemoryId; reason: string } | null,
) =>
  MemoryProposal.rehydrate({
    id: MemoryId.of('memory_forget'),
    kind: 'preference',
    body: MemoryBody.of('Name branches after the ticket.'),
    scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
    provenance: MemoryProvenance.of({
      taskId: TaskId.of('task_1'),
      runId: RunId.of('run_1'),
      steps: [],
      notes: [1],
    }),
    source: 'run',
    supersedes: null,
    retires,
    recordedAt: NOW,
    state,
    decision: state === 'proposed' ? null : DECIDED,
  });

const known = (
  handle: number,
  body: string,
  scope = MemoryScope.of({ teamId: TeamId.of('team_1') }),
) =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'preference',
    body: MemoryBody.of(body),
    scope,
    provenance: null,
    by: DECIDED,
  });

describe('MemoryProposal', () => {
  const RETIRES = { memory: MemoryId.of('memory_old'), reason: 'Gone.' };

  it('can be edited only while proposed, and never when it retires a memory', () => {
    expect(stored('proposed', null).editable).toBe(true);
    expect(stored('approved', null).editable).toBe(false);
    expect(stored('proposed', RETIRES).editable).toBe(false);
  });

  it('names the memory it retires when that memory is no longer active', () => {
    expect(stored('proposed', RETIRES).inactiveIn([])).toEqual(['memory_old']);
    expect(stored('proposed', null).inactiveIn([])).toEqual([]);
  });

  it('is compared with the memories while it is proposed and retires nothing', () => {
    expect(stored('proposed', null).comparable).toBe(true);
    expect(stored('proposed', RETIRES).comparable).toBe(false);
    expect(stored('approved', null).comparable).toBe(false);
  });

  it('names the active memory most like it that applies in the same place', () => {
    const same = known(2, 'Name the branches after their ticket.');
    const retired = known(4, 'Name branches after the ticket.').retire({
      by: UserId.of('user_ada'),
      reason: 'Gone.',
      at: NOW,
    });
    const unlike = known(5, 'Restart the worker after each deploy.');
    const proposal = stored('proposed', null);

    expect(proposal.similarIn([unlike, retired, same])?.handle.value).toBe(
      'M-2',
    );
    expect(proposal.similarIn([unlike, retired])).toBeNull();
    expect(
      proposal.similarIn([
        known(
          6,
          'Name branches after the ticket.',
          MemoryScope.of({ teamId: TeamId.of('team_2') }),
        ),
      ]),
    ).toBeNull();
    expect(stored('approved', null).similarIn([same])).toBeNull();
  });

  it('lapses an approved retirement and keeps who approved it', () => {
    const lapsed = stored('approved', RETIRES).lapse();

    expect(lapsed.state).toBe('lapsed');
    expect(lapsed.decision?.equals(DECIDED)).toBe(true);
  });

  it('lapses nothing but an approved retirement', () => {
    expect(() => stored('approved', null).lapse()).toThrow(
      InconsistentStateError,
    );
  });

  it('refuses a stored lapsed proposal that retires nothing', () => {
    expect(() => stored('lapsed', null)).toThrow(InconsistentStateError);
  });
});
