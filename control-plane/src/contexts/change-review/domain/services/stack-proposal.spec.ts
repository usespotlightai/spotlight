import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import { NO_FACTS } from '@change-review/domain/services/diff-facts';
import { StackProposal } from '@change-review/domain/services/stack-proposal';
import {
  Diff,
  type DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  CohortKind,
  FileNote,
  ProposedCohort,
  ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, start: number): DiffHunk => ({
  id: HunkId.of(id),
  oldStart: start,
  oldLines: 1,
  newStart: start,
  newLines: 1,
  patch: `@@ -${start} +${start} @@\n-before\n+after`,
});

const DIFF = Diff.of([
  {
    path: 'src/invite.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [hunk('h1', 1), hunk('h2', 20)],
  },
  {
    path: 'src/routes.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [hunk('h3', 1)],
  },
]);

const proposal = (
  notes: FileNote[],
  kind: CohortKind = 'change',
  questions: ProposedQuestion[] = [],
): ProposedCohort[] => [
  {
    kind,
    title: 'Team invitations',
    intent: 'Let admins invite people',
    layers: [
      {
        title: 'Add invitations',
        summary: 'The function and its route',
        dependsOn: [],
        hunks: [
          { hunk: HunkId.of('h1') },
          { hunk: HunkId.of('h2') },
          { hunk: HunkId.of('h3') },
        ],
        notes,
        questions,
      },
    ],
  },
];

const ASKED: ProposedQuestion = {
  question: ' What happens when the route gets no team? ',
  answer: ' It answers 404 before it invites anyone. ',
  hunks: [HunkId.of('h3'), HunkId.of('h1'), HunkId.of('h3')],
};

const NOTED: FileNote[] = [
  { path: 'src/invite.ts', note: ' Adds the function that invites. ' },
  { path: 'src/routes.ts', note: 'Mounts it under /invitations.' },
];

const validated = (cohorts: ProposedCohort[]) =>
  StackProposal.validate({ diff: DIFF, facts: NO_FACTS, cohorts });

const problemsOf = (cohorts: ProposedCohort[]) => {
  try {
    validated(cohorts);
  } catch (error) {
    if (error instanceof InvalidChangeStackError) {
      return error.problems;
    }
    throw error;
  }
  return [];
};

describe('StackProposal', () => {
  it('keeps one note per file a layer touches', () => {
    const [cohort] = validated(proposal(NOTED));

    expect(cohort?.layers[0]?.hunks).toEqual([
      { hunk: HunkId.of('h1') },
      { hunk: HunkId.of('h2') },
      { hunk: HunkId.of('h3') },
    ]);
    expect(cohort?.layers[0]?.notes).toEqual([
      { path: 'src/invite.ts', note: 'Adds the function that invites.' },
      { path: 'src/routes.ts', note: 'Mounts it under /invitations.' },
    ]);
  });

  it('rejects a change layer that leaves a file it touches without a note', () => {
    expect(problemsOf(proposal(NOTED.slice(0, 1)))).toEqual([
      {
        code: 'shape',
        message: 'cohort 1, layer 1 has no note on src/routes.ts',
      },
    ]);
  });

  it('rejects a note on a file the layer does not touch', () => {
    expect(
      problemsOf(
        proposal([...NOTED, { path: 'src/mail.ts', note: 'Sends it.' }]),
      ).map((each) => each.message),
    ).toEqual([
      'cohort 1, layer 1 notes src/mail.ts, which none of its hunks touch',
    ]);
  });

  it('rejects two notes on one file', () => {
    expect(
      problemsOf(
        proposal([
          ...NOTED,
          { path: 'src/invite.ts', note: 'Adds invite, again.' },
        ]),
      ).map((each) => each.message),
    ).toEqual(['cohort 1, layer 1 notes src/invite.ts 2 times']);
  });

  it('rejects a blank note or one too long', () => {
    expect(
      problemsOf(
        proposal([
          { path: 'src/invite.ts', note: '  ' },
          { path: 'src/routes.ts', note: 'x'.repeat(2_001) },
        ]),
      ).map((each) => each.message),
    ).toEqual([
      'cohort 1, layer 1 needs a note on src/invite.ts of at most 2000 characters',
      'cohort 1, layer 1 needs a note on src/routes.ts of at most 2000 characters',
    ]);
  });

  it('needs no notes on incidental changes, but still rejects wrong ones', () => {
    expect(problemsOf(proposal([], 'incidental'))).toEqual([]);
    expect(
      problemsOf(
        proposal([{ path: 'src/mail.ts', note: 'Sends it.' }], 'incidental'),
      ).map((each) => each.message),
    ).toEqual([
      'cohort 1, layer 1 notes src/mail.ts, which none of its hunks touch',
    ]);
  });

  it('numbers the questions of a layer and keeps each cited hunk once', () => {
    const [cohort] = validated(proposal(NOTED, 'change', [ASKED]));

    expect(cohort?.layers[0]?.questions).toEqual([
      {
        id: 'c1.l1.q1',
        question: 'What happens when the route gets no team?',
        answer: 'It answers 404 before it invites anyone.',
        hunks: [HunkId.of('h3'), HunkId.of('h1')],
      },
    ]);
  });

  it('keeps at most two questions on a layer, and none on incidental changes', () => {
    const asked = (question: string) => ({ ...ASKED, question });

    expect(
      validated(
        proposal(NOTED, 'change', [asked('A?'), asked('B?'), asked('C?')]),
      )[0]?.layers[0]?.questions.map((each) => each.question),
    ).toEqual(['A?', 'B?']);
    expect(
      validated(proposal([], 'incidental', [ASKED]))[0]?.layers[0]?.questions,
    ).toEqual([]);
  });

  it('drops a question without an answer, or with hunks it cannot cite, and keeps the stack', () => {
    const [cohort] = validated(
      proposal(NOTED, 'change', [
        { question: 'Why?', answer: ' ', hunks: [] },
        { ...ASKED, hunks: [HunkId.of('h9')] },
        ASKED,
      ]),
    );

    expect(cohort?.layers[0]?.questions.map((each) => each.id)).toEqual([
      'c1.l1.q1',
    ]);
    expect(cohort?.layers[0]?.questions[0]?.question).toBe(
      'What happens when the route gets no team?',
    );
  });
});
