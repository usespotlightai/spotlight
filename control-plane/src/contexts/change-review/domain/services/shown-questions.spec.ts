import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import { keptQuestions } from '@change-review/domain/services/shown-questions';
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

const _DIFF = Diff.of(['h1', 'h2', 'h3'].map(file));

const _FACTS: DiffFacts = {
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

describe('keptQuestions', () => {
  it('keeps the questions whose hunks a layer has shown, at most two', () => {
    const asked = (hunk: string, question: string) => ({
      question,
      answer: 'Yes.',
      hunks: [HunkId.of(hunk)],
    });
    const proposed = cohort([
      layer(['h1'], {
        questions: [
          asked('h2', 'Later?'),
          asked('h1', 'One?'),
          asked('h1', 'Two?'),
          asked('h1', 'Three?'),
        ],
      }),
      layer(['h2']),
    ]);

    expect(keptQuestions(proposed, 0).map((each) => each.question)).toEqual([
      'One?',
      'Two?',
    ]);
  });
});
