import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { DuplicateQuestion } from '@memory/domain/value-objects/duplicate-question.vo';
import { DuplicateVerdict } from '@memory/domain/value-objects/duplicate-verdict.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const LATER = new Date(NOW.getTime() + 5_000);
const P1 = MemoryId.of('proposal_1');
const M2 = MemoryId.of('memory_2');
const M5 = MemoryId.of('memory_5');

const ASKED_P1 = {
  proposal: P1,
  kind: 'environment',
  body: 'npm ci fails in the sandbox; use npm ci --ignore-scripts.',
  where: 'the whole team',
  candidates: [M2],
} as const;

const QUESTION = DuplicateQuestion.asking({
  proposals: [ASKED_P1],
  memories: [
    {
      memory: M2,
      handle: MemoryHandle.of(2),
      kind: 'environment',
      body: 'The runner image has no make/g++.',
      where: 'the whole team',
    },
    {
      memory: M5,
      handle: MemoryHandle.of(5),
      kind: 'preference',
      body: 'Name branches after the ticket.',
      where: 'the whole team',
    },
  ],
});

const due = () =>
  DuplicateCheck.due({
    runId: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    taskId: TaskId.of('task_1'),
    setId: MemoryProposalSetId.of('set_1'),
    now: NOW,
  });

const asked = () => due().leaseJob(NOW).asking(QUESTION);

const verdict = (repeats: MemoryId | null, proposal = P1) =>
  DuplicateVerdict.of({ proposal, repeats, reason: 'Says the same.' });

describe('a duplicate check', () => {
  it('is due once opened, for its own set only', () => {
    expect(due().state).toBe('pending');
    expect(due().isDue(NOW)).toBe(true);
    expect(due().question).toBeNull();
    expect(due().isFor(MemoryProposalSetId.of('set_1'))).toBe(true);
    expect(due().isFor(MemoryProposalSetId.of('set_2'))).toBe(false);
  });

  it('records its question once, and keeps it while it waits', () => {
    const other = DuplicateQuestion.asking({
      proposals: [{ ...ASKED_P1, candidates: [M5] }],
      memories: QUESTION.memories,
    });
    const waiting = asked().waitJob(NOW);

    expect(waiting.question).toBe(QUESTION);
    expect(waiting.asking(other).question).toBe(QUESTION);
  });

  it('waits for its session without spending an attempt, and wakes once it settles', () => {
    const waiting = asked().waitJob(NOW);

    expect(waiting.job.attempts).toBe(0);
    expect(waiting.isDue(LATER)).toBe(false);
    expect(waiting.mayWaitAgain(LATER)).toBe(true);
    expect(waiting.wake(LATER).isDue(LATER)).toBe(true);
    expect(due().wake(LATER)).toEqual(due());
  });

  it('records verdicts about what it asked, and is done', () => {
    const compared = asked().compared([verdict(M2)]);

    expect(compared.state).toBe('compared');
    expect(compared.hasPendingJob).toBe(false);
    expect(compared.verdictFor(P1)?.repeats).toEqual(M2);
    expect(compared.verdictFor(MemoryId.of('proposal_9'))).toBeNull();
    expect(compared.repeatedMemories).toEqual([M2]);
  });

  it('refuses a verdict it did not ask for: another proposal, a memory it did not compare, or a second one', () => {
    expect(() =>
      asked().compared([verdict(null, MemoryId.of('proposal_9'))]),
    ).toThrow('records only verdicts about what it asked');
    expect(() => asked().compared([verdict(M5)])).toThrow(
      'records only verdicts about what it asked',
    );
    expect(() => asked().compared([verdict(null), verdict(M2)])).toThrow(
      'records only verdicts about what it asked',
    );
    expect(() =>
      due()
        .leaseJob(NOW)
        .compared([verdict(null)]),
    ).toThrow('records only verdicts about what it asked');
  });

  it('is done without verdicts when it had nothing to ask', () => {
    expect(due().leaseJob(NOW).compared([]).state).toBe('compared');
  });

  it('fails without verdicts, and a done check stays as it is', () => {
    const failed = asked().failed();

    expect(failed.state).toBe('failed');
    expect(failed.hasPendingJob).toBe(false);
    expect(failed.compared([])).toBe(failed);
    expect(asked().deadLetter().state).toBe('failed');
    expect(() => failed.leaseJob(LATER)).toThrow(
      'A duplicate check is not due yet.',
    );
  });

  it('can be deleted', () => {
    expect(due().isDeleted).toBe(false);
    expect(due().delete().isDeleted).toBe(true);
  });
});

describe('a duplicate question', () => {
  it('names its proposals P-1, P-2 and so on, and finds a memory only among a proposal’s candidates', () => {
    const asked = QUESTION.proposalNamed(' p-1 ');

    expect(asked?.proposal).toEqual(P1);
    expect(QUESTION.proposalNamed('P-2')).toBeNull();
    expect(asked && QUESTION.candidateOf(asked, MemoryHandle.of(2))).toEqual(
      M2,
    );
    expect(asked && QUESTION.candidateOf(asked, MemoryHandle.of(5))).toBeNull();
  });

  it('compares each proposal with memories it shows', () => {
    expect(() =>
      DuplicateQuestion.asking({
        proposals: [{ ...ASKED_P1, candidates: [MemoryId.of('m_9')] }],
        memories: QUESTION.memories,
      }),
    ).toThrow('compares each proposal with memories it shows');
    expect(() =>
      DuplicateQuestion.asking({ proposals: [], memories: [] }),
    ).toThrow('asks about a proposal');
  });
});

describe('a duplicate verdict', () => {
  it('says why', () => {
    expect(() =>
      DuplicateVerdict.of({ proposal: P1, repeats: null, reason: '  ' }),
    ).toThrow('A duplicate verdict says why.');
  });
});
