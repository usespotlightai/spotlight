import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import {
  candidatesOf,
  checkFor,
  isCandidate,
  MAX_ASKED,
  MAX_CANDIDATES,
  MAX_SHOWN,
  questionFor,
  repeatShown,
  verdictsFrom,
} from '@memory/domain/services/duplicate-comparison';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_ada');
const DECIDED = MemoryDecision.of({ by: ADA, at: NOW });
const TEAM_WIDE = MemoryScope.of({ teamId: TEAM });

const memoryOf = (
  handle: number,
  input: { scope?: MemoryScope; at?: Date; body?: string } = {},
): Memory =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'environment',
    body: MemoryBody.of(input.body ?? `Memory ${handle}.`),
    scope: input.scope ?? TEAM_WIDE,
    provenance: null,
    by: MemoryDecision.of({ by: ADA, at: input.at ?? NOW }),
  });

const M2 = memoryOf(2, {
  body: 'qa-tidepool: the runner image has no make/g++, so better-sqlite3 cannot build. Use `npm install --ignore-scripts` (better-sqlite3 still loads) until the image is fixed.',
});

const proposalOf = (
  id: string,
  input: {
    supersedes?: MemoryId;
    runId?: RunId;
    body?: string;
    scope?: MemoryScope;
  } = {},
): MemoryProposal =>
  MemoryProposal.of({
    id: MemoryId.of(id),
    kind: 'environment',
    body: MemoryBody.of(
      input.body ??
        'npm ci fails in the sandbox on the better-sqlite3 node-gyp build; use npm ci --ignore-scripts.',
    ),
    scope: input.scope ?? TEAM_WIDE,
    provenance: MemoryProvenance.of({
      taskId: TaskId.of('task_1'),
      runId: input.runId ?? RUN,
      steps: [1],
      notes: [],
    }),
    source: 'run',
    supersedes: input.supersedes ?? null,
    recordedAt: NOW,
  });

const P1 = proposalOf('proposal_1');

const setOf = (...proposals: MemoryProposal[]) =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of('set_1'),
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    proposals,
    version: 1,
  });

const whereOf = (scope: MemoryScope) =>
  scope.lineId ? `the line ${scope.lineId.value}` : 'the whole team';

const questionOf = (
  proposals: readonly MemoryProposal[],
  memories: readonly Memory[],
) => questionFor({ set: setOf(...proposals), runId: RUN, memories, whereOf });

describe('the memories a proposal is compared with', () => {
  it('are the active memories of its team that apply where it applies', () => {
    const retired = memoryOf(4).retire({
      by: ADA,
      reason: 'Gone.',
      at: NOW,
    });

    expect(isCandidate(P1, M2)).toBe(true);
    expect(isCandidate(P1, retired)).toBe(false);
    expect(
      isCandidate(
        P1,
        memoryOf(6, { scope: MemoryScope.of({ teamId: TeamId.of('team_2') }) }),
      ),
    ).toBe(false);
    expect(
      isCandidate(
        proposalOf('proposal_2', {
          scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_1') }),
        }),
        memoryOf(7, {
          scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_2') }),
        }),
      ),
    ).toBe(false);
  });

  it('leave out the proposal itself and the memory it supersedes', () => {
    const superseded = memoryOf(3);

    expect(
      isCandidate(
        proposalOf('proposal_1', { supersedes: superseded.id }),
        superseded,
      ),
    ).toBe(false);
    expect(
      isCandidate(
        P1,
        Memory.write({
          id: P1.id,
          handle: MemoryHandle.of(9),
          workspaceId: WorkspaceId.of('ws_1'),
          kind: 'environment',
          body: P1.body,
          scope: TEAM_WIDE,
          provenance: null,
          by: DECIDED,
        }),
      ),
    ).toBe(false);
  });

  it('are none once the proposal is decided, or when it retires a memory', () => {
    const retiring = MemoryProposal.retiring({
      id: MemoryId.of('proposal_3'),
      retired: M2,
      reason: 'The image is fixed.',
      provenance: P1.provenance,
      source: 'run',
      recordedAt: NOW,
    });

    expect(isCandidate(P1.approve(DECIDED), M2)).toBe(false);
    expect(isCandidate(retiring, memoryOf(5))).toBe(false);
  });

  it(`are at most ${MAX_CANDIDATES}, the most specific first and then the newest`, () => {
    const onLine = memoryOf(100, {
      scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_1') }),
      at: new Date(NOW.getTime() - 60_000),
    });
    const teamWide = Array.from({ length: MAX_CANDIDATES + 5 }, (_, at) =>
      memoryOf(at + 1, { at: new Date(NOW.getTime() + at * 1_000) }),
    );
    const proposal = proposalOf('proposal_4', {
      scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_1') }),
    });

    const chosen = candidatesOf(proposal, [...teamWide, onLine]);

    expect(chosen).toHaveLength(MAX_CANDIDATES);
    expect(chosen[0]).toBe(onLine);
    expect(chosen.slice(1).map((each) => each.handle.number)).toEqual([
      15, 14, 13, 12, 11, 10, 9, 8, 7,
    ]);
  });
});

describe('opening a duplicate check', () => {
  it('opens one for a run that proposed a memory to compare, and none otherwise', () => {
    const check = checkFor({ set: setOf(P1), runId: RUN, now: NOW });

    expect(check?.teamId).toEqual(TEAM);
    expect(check?.setId.value).toBe('set_1');
    expect(
      checkFor({ set: setOf(P1), runId: RunId.of('run_2'), now: NOW }),
    ).toBeNull();
    expect(
      checkFor({ set: setOf(P1.approve(DECIDED)), runId: RUN, now: NOW }),
    ).toBeNull();
  });
});

describe('the question a check asks', () => {
  it('asks about each proposal of the run with candidates, under refs, with where each applies', () => {
    const lonely = proposalOf('proposal_2', {
      scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_1') }),
    });
    const elsewhere = proposalOf('proposal_3', { runId: RunId.of('run_2') });
    const onOtherLine = memoryOf(8, {
      scope: MemoryScope.of({ teamId: TEAM, lineId: LineId.of('line_2') }),
    });

    const question = questionOf([P1, elsewhere, lonely], [M2, onOtherLine]);

    expect(
      question?.proposals.map((each) => [
        each.ref,
        each.proposal.value,
        each.where,
        each.candidates.map((id) => id.value),
      ]),
    ).toEqual([
      ['P-1', 'proposal_1', 'the whole team', ['memory_8', 'memory_2']],
      ['P-2', 'proposal_2', 'the line line_1', ['memory_2']],
    ]);
    expect(question?.memories.map((each) => each.where)).toEqual([
      'the line line_2',
      'the whole team',
    ]);
    expect(questionOf([P1], [])).toBeNull();
  });

  it(`asks about at most ${MAX_ASKED} proposals and shows at most ${MAX_SHOWN} memories`, () => {
    const proposals = Array.from({ length: MAX_ASKED + 3 }, (_, at) =>
      proposalOf(`proposal_${at + 1}`, { body: `Proposal ${at + 1}.` }),
    );
    const memories = Array.from({ length: MAX_SHOWN * 2 }, (_, at) =>
      memoryOf(at + 1, { at: new Date(NOW.getTime() + at * 1_000) }),
    );

    const question = questionOf(proposals, memories);

    expect(question?.proposals).toHaveLength(MAX_ASKED);
    expect(question?.memories.length).toBeLessThanOrEqual(MAX_SHOWN);
  });
});

describe('the verdicts a check records', () => {
  const question = questionOf([P1], [M2, memoryOf(5)]);

  const read = (reported: Parameters<typeof verdictsFrom>[1]) =>
    question ? verdictsFrom(question, reported) : [];

  it('names the memory a proposal repeats by its handle, for the proposal named by its ref', () => {
    expect(
      read([{ proposal: 'P-1', sameAs: 'M-2', reason: ' Same as M-2. ' }]).map(
        (each) => [each.proposal.value, each.repeats?.value, each.reason],
      ),
    ).toEqual([['proposal_1', 'memory_2', 'Same as M-2.']]);
  });

  it('drops a verdict naming a memory it was not compared with, an unknown ref or handle, or no reason', () => {
    expect(
      read([
        { proposal: 'P-1', sameAs: 'M-77', reason: 'Made up.' },
        { proposal: 'P-1', sameAs: 'garbled', reason: 'No handle.' },
        { proposal: 'P-9', sameAs: 'M-2', reason: 'Not asked.' },
        { proposal: 'P-1', sameAs: 'M-2', reason: '   ' },
      ]),
    ).toEqual([]);
    const onLine = (line: string) =>
      MemoryScope.of({ teamId: TEAM, lineId: LineId.of(line) });
    const shownForAnother = questionOf(
      [
        proposalOf('proposal_1', { scope: onLine('line_2') }),
        proposalOf('proposal_2', { scope: onLine('line_1') }),
      ],
      [
        memoryOf(8, { scope: onLine('line_1') }),
        memoryOf(9, { scope: onLine('line_2') }),
      ],
    );

    expect(
      shownForAnother?.memories.map((each) => each.handle.value).sort(),
    ).toEqual(['M-8', 'M-9']);
    expect(
      shownForAnother &&
        verdictsFrom(shownForAnother, [
          { proposal: 'P-1', sameAs: 'M-8', reason: 'Another’s candidate.' },
        ]),
    ).toEqual([]);
  });

  it('keeps the first verdict for a proposal, and one that it repeats nothing', () => {
    expect(
      read([
        { proposal: 'P-1', sameAs: null, reason: 'About the CI image.' },
        { proposal: 'P-1', sameAs: 'M-2', reason: 'Second thoughts.' },
      ]).map((each) => each.repeats),
    ).toEqual([null]);
  });
});

describe('the repeat a review shows', () => {
  const checked = () => {
    const check = checkFor({ set: setOf(P1), runId: RUN, now: NOW });
    const question = questionOf([P1], [M2]);

    if (!check || !question) {
      throw new Error('expected a check and a question');
    }

    return check
      .leaseJob(NOW)
      .asking(question)
      .compared(
        verdictsFrom(question, [
          { proposal: 'P-1', sameAs: 'M-2', reason: 'Same as M-2.' },
        ]),
      );
  };

  it('is the memory the check found, with its reason', () => {
    expect(repeatShown(checked(), P1, [M2])).toEqual({
      memory: M2,
      reason: 'Same as M-2.',
    });
  });

  it('is none before a check, once the proposal is decided, or once the memory is retired', () => {
    const retired = M2.retire({ by: ADA, reason: 'Fixed.', at: NOW });

    expect(repeatShown(null, P1, [M2])).toBeNull();
    expect(repeatShown(checked(), P1.reject(DECIDED), [M2])).toBeNull();
    expect(repeatShown(checked(), P1, [retired])).toBeNull();
    expect(repeatShown(checked(), P1, [])).toBeNull();
  });
});
