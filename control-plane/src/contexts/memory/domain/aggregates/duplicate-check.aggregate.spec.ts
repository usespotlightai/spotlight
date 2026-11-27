import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const LATER = new Date(NOW.getTime() + 5_000);
const RUN = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const DECIDED = MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW });

const memoryOf = (handle: number, body: string, teamId = TEAM): Memory =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'environment',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId }),
    provenance: null,
    by: DECIDED,
  });

const M2 = memoryOf(
  2,
  'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
);
const M5 = memoryOf(5, 'Name branches after the ticket.');
const ELSEWHERE = memoryOf(9, 'npm ci fails here too.', TeamId.of('team_2'));

const proposalOf = (
  id: string,
  body: string,
  input: { runId?: RunId; state?: 'proposed' | 'rejected' } = {},
): MemoryProposal =>
  MemoryProposal.rehydrate({
    id: MemoryId.of(id),
    kind: 'environment',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId: TEAM }),
    provenance: MemoryProvenance.of({
      taskId: TaskId.of('task_1'),
      runId: input.runId ?? RUN,
      steps: [],
      notes: [1],
    }),
    source: 'run',
    supersedes: null,
    retires: null,
    recordedAt: NOW,
    state: input.state ?? 'proposed',
    decision: (input.state ?? 'proposed') === 'proposed' ? null : DECIDED,
  });

const P1 = proposalOf(
  'proposal_1',
  'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
);

const setOf = (...proposals: MemoryProposal[]) =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    proposals,
    version: 3,
  });

const due = (set = setOf(P1)): DuplicateCheck => {
  const check = DuplicateCheck.of({ runId: RUN, set, now: NOW });

  if (!check) {
    throw new Error('expected a check');
  }

  return check;
};

const comparedWith = (
  reported: Parameters<DuplicateCheck['compared']>[1],
  set = setOf(P1),
) => {
  const check = due(set).leaseJob(NOW);

  return check.compared(check.comparing(set, [M2, M5, ELSEWHERE]), reported);
};

describe('a duplicate check', () => {
  it('is due for a run that proposed a memory to compare, and none for a run that did not', () => {
    const check = due();

    expect(check.runId).toEqual(RUN);
    expect(check.teamId).toEqual(TEAM);
    expect(check.setId.value).toBe('set_1');
    expect(check.state).toBe('pending');
    expect(check.isDue(NOW)).toBe(true);
    expect(
      DuplicateCheck.of({
        runId: RunId.of('run_2'),
        set: setOf(P1),
        now: NOW,
      }),
    ).toBeNull();
    expect(
      DuplicateCheck.of({
        runId: RUN,
        set: setOf(proposalOf('proposal_2', 'Old.', { state: 'rejected' })),
        now: NOW,
      }),
    ).toBeNull();
  });

  it('compares each proposal of its run with its candidates, and leaves out one with none', () => {
    const lonely = proposalOf('proposal_3', 'Something new.');
    const other = proposalOf('proposal_4', 'Another run.', {
      runId: RunId.of('run_2'),
    });
    const set = setOf(P1, lonely, other);

    expect(
      due(set)
        .comparing(set, [M2, ELSEWHERE])
        .map(({ proposal, candidates }) => [
          proposal.id.value,
          candidates.map((each) => each.handle.value),
        ]),
    ).toEqual([
      ['proposal_1', ['M-2']],
      ['proposal_3', ['M-2']],
    ]);
    expect(due(set).comparing(setOf(P1), [])).toEqual([]);
    expect(
      due(set).comparing(
        MemoryProposalSet.create({
          id: MemoryProposalSetId.of('set_2'),
          taskId: TaskId.of('task_1'),
          workspaceId: WorkspaceId.of('ws_1'),
        }),
        [M2],
      ),
    ).toEqual([]);
    expect(due(set).comparing(null, [M2])).toEqual([]);
  });

  it('waits for its session without spending an attempt, and wakes once it settles', () => {
    const waiting = due().leaseJob(NOW).waitJob(NOW);

    expect(waiting.job.attempts).toBe(0);
    expect(waiting.isDue(LATER)).toBe(false);
    expect(waiting.mayWaitAgain(LATER)).toBe(true);
    expect(waiting.wake(LATER).isDue(LATER)).toBe(true);
    expect(due().wake(LATER)).toEqual(due());
  });

  it('records the memory a proposal repeats and the reason, then is done', () => {
    const check = comparedWith([
      {
        proposal: P1.id,
        sameAs: 'M-2',
        reason: ' P-1 says what M-2 says about better-sqlite3. ',
      },
    ]);

    expect(check.state).toBe('compared');
    expect(check.hasPendingJob).toBe(false);
    expect(check.repeatedMemories).toEqual([M2.id]);
    expect(check.repeatOf(P1, [M2, M5])).toEqual({
      memory: M2,
      reason: 'P-1 says what M-2 says about better-sqlite3.',
    });
  });

  it('drops a verdict that names a memory the proposal was not compared with, or a proposal it was not asked about', () => {
    const check = comparedWith([
      { proposal: P1.id, sameAs: 'M-9', reason: 'Another team says it.' },
      { proposal: P1.id, sameAs: 'M-77', reason: 'Made up.' },
      {
        proposal: MemoryId.of('proposal_unknown'),
        sameAs: 'M-2',
        reason: 'Not asked.',
      },
      { proposal: P1.id, sameAs: 'garbled', reason: 'No handle.' },
    ]);

    expect(check.state).toBe('compared');
    expect(check.verdicts).toEqual([]);
    expect(check.repeatOf(P1, [M2, ELSEWHERE])).toBeNull();
  });

  it('keeps the first verdict for a proposal and a verdict that it repeats nothing', () => {
    const check = comparedWith([
      { proposal: P1.id, sameAs: null, reason: 'P-1 is about the CI image.' },
      { proposal: P1.id, sameAs: 'M-2', reason: 'Second thoughts.' },
    ]);

    expect(check.verdicts.map((each) => each.repeats)).toEqual([null]);
    expect(check.repeatOf(P1, [M2])).toBeNull();
  });

  it('shows no repeat once the proposal is decided, or the memory is retired', () => {
    const check = comparedWith([
      { proposal: P1.id, sameAs: 'M-2', reason: 'Same.' },
    ]);
    const rejected = proposalOf('proposal_1', P1.body.value, {
      state: 'rejected',
    });
    const retired = M2.retire({
      by: UserId.of('user_ada'),
      reason: 'The image is fixed.',
      at: LATER,
    });

    expect(check.repeatOf(rejected, [M2])).toBeNull();
    expect(check.repeatOf(P1, [retired])).toBeNull();
    expect(check.repeatOf(P1, [])).toBeNull();
  });

  it('fails without verdicts, and a done check stays as it is', () => {
    const failed = due().leaseJob(NOW).failed();

    expect(failed.state).toBe('failed');
    expect(failed.hasPendingJob).toBe(false);
    expect(failed.repeatOf(P1, [M2])).toBeNull();
    expect(failed.compared([], [])).toBe(failed);
    expect(due().leaseJob(NOW).deadLetter().state).toBe('failed');
  });

  it('cannot be leased once done', () => {
    expect(() => comparedWith([]).leaseJob(LATER)).toThrow(
      'A duplicate check is not due yet.',
    );
  });
});
