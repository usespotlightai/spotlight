import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
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

describe('MemoryProposal', () => {
  const RETIRES = { memory: MemoryId.of('memory_old'), reason: 'Gone.' };

  const STEP = {
    index: 3,
    kind: 'remember',
    text: 'spotlight remember --kind preference --body "First."',
    commands: [
      {
        proposes: 'memory' as const,
        carrying: 'First.',
        text: 'spotlight remember --kind preference --body "First."',
      },
      {
        proposes: 'memory' as const,
        carrying: 'Name branches after the ticket.',
        text: 'spotlight remember --kind preference --body "Name branches after the ticket."',
      },
    ],
  };

  const citing = (command: number | null) =>
    MemoryProposal.of({
      id: MemoryId.of('memory_cited'),
      kind: 'preference',
      body: MemoryBody.of('Name branches after the ticket.'),
      scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
      provenance: MemoryProvenance.of({
        taskId: TaskId.of('task_1'),
        runId: RunId.of('run_1'),
        steps: [3],
        notes: [],
        command,
      }),
      source: 'run',
      supersedes: null,
      recordedAt: NOW,
    });

  it('shows as its source the command of its step that proposed it, even once approved with another body', () => {
    const proposal = citing(1);

    expect(proposal.sourceOf(STEP)).toBe(STEP.commands[1]?.text);
    expect(proposal.approve(DECIDED, 'First.').sourceOf(STEP)).toBe(
      STEP.commands[1]?.text,
    );
  });

  it('shows the step as it reads where it names no command of it, or the step is another', () => {
    expect(citing(null).sourceOf(STEP)).toBe(STEP.text);
    expect(citing(1).sourceOf({ ...STEP, index: 4 })).toBe(STEP.text);
    expect(citing(5).sourceOf(STEP)).toBe(STEP.text);
  });

  it('can be edited only while proposed, and never when it retires a memory', () => {
    expect(stored('proposed', null).editable).toBe(true);
    expect(stored('approved', null).editable).toBe(false);
    expect(stored('proposed', RETIRES).editable).toBe(false);
  });

  it('names the memory it retires when that memory is no longer active', () => {
    expect(stored('proposed', RETIRES).inactiveIn([])).toEqual(['memory_old']);
    expect(stored('proposed', null).inactiveIn([])).toEqual([]);
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
