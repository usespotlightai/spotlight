import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import {
  changeLayerCount,
  cohortProblems,
  layerCountProblems,
} from '@change-review/domain/services/stack-checks';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const file = (id: string): DiffFile => ({
  path: `src/${id}.ts`,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.of(id),
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: `@@ -1 +1 @@\n-before\n+${id}`,
    },
  ],
});

const DIFF = Diff.of(['h1', 'h2', 'h3'].map(file));

const FACTS: DiffFacts = {
  hunks: [],
  links: [
    {
      kind: 'uses',
      from: HunkId.of('h2'),
      to: HunkId.of('h1'),
      because: ['Invite'],
    },
  ],
  imports: [],
};

const layer = (
  hunks: string[],
  over: Partial<ProposedLayer> = {},
): ProposedLayer => ({
  title: 'A layer',
  summary: 'A layer',
  dependsOn: [],
  hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
  notes: hunks.map((each) => ({ path: `src/${each}.ts`, note: 'Why' })),
  questions: [],
  ...over,
});

const cohort = (
  layers: ProposedLayer[],
  kind: ProposedCohort['kind'] = 'change',
): ProposedCohort => ({ kind, title: 'A cohort', intent: 'A cohort', layers });

describe('cohortProblems', () => {
  it('finds the problems of one cohort, not the hunks other cohorts place', () => {
    expect(
      cohortProblems(
        DIFF,
        FACTS,
        cohort([layer(['h2']), layer(['h1', 'h1'], { title: '' })]),
      ).map((each) => each.message),
    ).toEqual([
      'this cohort, layer 2 needs a title of at most 120 characters',
      'this cohort, layer 2 notes src/h1.ts 2 times',
      'assigns h1 2 times',
      'h2 uses Invite from h1, so it cannot come in an earlier layer than h1',
    ]);
  });
});

describe('layerCountProblems', () => {
  it('counts the layers of change cohorts against the least a redraft keeps', () => {
    const cohorts = [
      cohort([layer(['h1']), layer(['h2'])]),
      cohort([layer(['h3']), layer(['h3'])], 'incidental'),
    ];

    expect(changeLayerCount(cohorts)).toBe(2);
    expect(layerCountProblems(cohorts, 2)).toEqual([]);
    expect(layerCountProblems(cohorts, undefined)).toEqual([]);
    expect(layerCountProblems(cohorts, 3)).toEqual([
      {
        code: 'joined-layers',
        message: 'joins layers, leaving 2 where there were 3',
      },
    ]);
  });
});
