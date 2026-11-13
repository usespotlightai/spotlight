import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import { withLinkedHunksInOneCohort } from '@change-review/domain/services/linked-cohorts';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { OutlinedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const file = (id: string, lines: number): DiffFile => ({
  path: `src/${id}.ts`,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.of(id),
      oldStart: 1,
      oldLines: 0,
      newStart: 1,
      newLines: lines,
      patch: [
        `@@ -0,0 +1,${lines} @@`,
        ...Array.from({ length: lines }, (_, at) => `+${id} ${at}`),
      ].join('\n'),
    },
  ],
});

const DIFF = Diff.of([
  file('h1', 1),
  file('h2', 1),
  file('h3', 10),
  file('h4', 1),
]);

const uses = (from: string, to: string): HunkLink => ({
  kind: 'uses',
  from: HunkId.of(from),
  to: HunkId.of(to),
  because: ['invite'],
});

const facts = (links: HunkLink[]): DiffFacts => ({
  hunks: [],
  links,
  imports: [],
});

const cohort = (title: string, hunks: string[]): OutlinedCohort => ({
  kind: 'change',
  title,
  intent: title,
  joinedBecause: null,
  hunks: hunks.map((each) => HunkId.of(each)),
});

const grouped = (links: HunkLink[], cohorts: OutlinedCohort[]) =>
  withLinkedHunksInOneCohort(DIFF, facts(links), cohorts).map((each) => [
    each.title,
    each.hunks,
  ]);

describe('withLinkedHunksInOneCohort', () => {
  it('moves a linked group into the cohort that holds most of its lines', () => {
    expect(
      grouped(
        [uses('h1', 'h3'), uses('h2', 'h3')],
        [cohort('A', ['h1', 'h2', 'h4']), cohort('B', ['h3'])],
      ),
    ).toEqual([
      ['A', ['h4']],
      ['B', ['h1', 'h2', 'h3']],
    ]);
  });

  it('drops a cohort that the move empties', () => {
    expect(
      grouped(
        [uses('h1', 'h3')],
        [cohort('A', ['h1']), cohort('B', ['h3', 'h4'])],
      ),
    ).toEqual([['B', ['h1', 'h3', 'h4']]]);
  });

  it('keeps a group in the earlier cohort when both hold as many lines', () => {
    expect(
      grouped([uses('h2', 'h1')], [cohort('A', ['h1']), cohort('B', ['h2'])]),
    ).toEqual([['A', ['h1', 'h2']]]);
  });

  it('leaves cohorts that place a hunk twice to the model', () => {
    const cohorts = [cohort('A', ['h1']), cohort('B', ['h1', 'h3'])];

    expect(
      withLinkedHunksInOneCohort(DIFF, facts([uses('h1', 'h3')]), cohorts),
    ).toBe(cohorts);
  });

  it('changes nothing when every linked group is in one cohort', () => {
    const cohorts = [cohort('A', ['h1', 'h3']), cohort('B', ['h2'])];

    expect(
      withLinkedHunksInOneCohort(DIFF, facts([uses('h1', 'h3')]), cohorts),
    ).toBe(cohorts);
  });
});
