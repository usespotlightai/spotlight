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
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, start: number): DiffHunk => ({
  id,
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
        ranges: [{ hunk: 'h1' }, { hunk: 'h2' }, { hunk: 'h3' }],
        notes,
      },
    ],
  },
];

const NOTED: FileNote[] = [
  { path: 'src/invite.ts', note: ' Adds the function that invites. ' },
  { path: 'src/routes.ts', note: 'Mounts it under /invitations.' },
];

const settled = (cohorts: ProposedCohort[]) =>
  StackProposal.settle({ diff: DIFF, facts: NO_FACTS, cohorts, strict: false });

const problemsOf = (cohorts: ProposedCohort[]) => {
  try {
    settled(cohorts);
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
    const [cohort] = settled(proposal(NOTED));

    expect(cohort?.layers[0]?.ranges).toEqual([
      { hunk: 'h1' },
      { hunk: 'h2' },
      { hunk: 'h3' },
    ]);
    expect(cohort?.layers[0]?.notes).toEqual([
      { path: 'src/invite.ts', note: 'Adds the function that invites.' },
      { path: 'src/routes.ts', note: 'Mounts it under /invitations.' },
    ]);
  });

  it('refuses a change layer that leaves a file it touches without a note', () => {
    expect(problemsOf(proposal(NOTED.slice(0, 1)))).toEqual([
      {
        code: 'shape',
        message: 'cohort 1, layer 1 gives no note on src/routes.ts',
      },
    ]);
  });

  it('refuses a note on a file the layer does not touch', () => {
    expect(
      problemsOf(
        proposal([...NOTED, { path: 'src/mail.ts', note: 'Sends it.' }]),
      ).map((each) => each.message),
    ).toEqual([
      'cohort 1, layer 1 notes src/mail.ts, which none of its changes touch',
    ]);
  });

  it('refuses two notes on one file', () => {
    expect(
      problemsOf(
        proposal([
          ...NOTED,
          { path: 'src/invite.ts', note: 'Adds invite, again.' },
        ]),
      ).map((each) => each.message),
    ).toEqual(['cohort 1, layer 1 notes src/invite.ts 2 times']);
  });

  it('refuses a blank note or one too long', () => {
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

  it('needs no notes on incidental changes, but still refuses wrong ones', () => {
    expect(problemsOf(proposal([], 'incidental'))).toEqual([]);
    expect(
      problemsOf(
        proposal([{ path: 'src/mail.ts', note: 'Sends it.' }], 'incidental'),
      ).map((each) => each.message),
    ).toEqual([
      'cohort 1, layer 1 notes src/mail.ts, which none of its changes touch',
    ]);
  });
});
