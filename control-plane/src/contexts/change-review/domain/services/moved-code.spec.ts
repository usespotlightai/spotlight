import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import { withMovedCodeTogether } from '@change-review/domain/services/moved-code';
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

const IDS = ['h1', 'h2', 'h3', 'h4'];

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

const DIFF = Diff.of(IDS.map(file));

const link = (
  kind: HunkLink['kind'],
  from: string,
  to: string,
  because = 'a → b',
): HunkLink => ({
  kind,
  from: HunkId.of(from),
  to: HunkId.of(to),
  because: [because],
});

const facts = (links: HunkLink[]): DiffFacts => ({
  hunks: IDS.map((id) => ({
    hunk: HunkId.of(id),
    path: `src/${id}.ts`,
    fileClass: 'source',
    incidental: false,
    renamed: false,
    moved: false,
    linkable: true,
    defines: [],
    outside: [],
  })),
  links,
  imports: [],
});

const layer = (
  hunks: string[],
  dependsOn: ProposedLayer['dependsOn'] = [],
): ProposedLayer => ({
  title: `Layer of ${hunks.join(', ')}`,
  summary: 'A layer',
  dependsOn,
  hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
  notes: hunks.map((each) => ({
    path: `src/${each}.ts`,
    note: `${each} note`,
  })),
  questions: [],
});

const cohort = (layers: ProposedLayer[]): ProposedCohort => ({
  kind: 'change',
  title: 'A cohort',
  intent: 'A cohort',
  layers,
});

const hunksOf = (each: ProposedCohort) =>
  each.layers.map((one) => one.hunks.map((entry) => entry.hunk));

const asked = (hunks: string[]) => ({
  question: `What does ${hunks.join(' and ')} show?`,
  answer: 'The invitation flow.',
  hunks: hunks.map((each) => HunkId.of(each)),
});

describe('withMovedCodeTogether', () => {
  it('puts moved code in one layer and keeps the note on its file', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h3', 'h1'), link('uses', 'h2', 'h1', 'Invite')]),
      cohort([layer(['h1', 'h2']), layer(['h3'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h1', 'h2', 'h3']]);
    expect(arranged.layers[0]?.notes.map((each) => each.path)).toEqual([
      'src/h1.ts',
      'src/h2.ts',
      'src/h3.ts',
    ]);
  });

  it('writes no note for a moved file that had none', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([layer(['h1']), { ...layer(['h2']), notes: [] }]),
    );

    expect(arranged.layers.map((each) => each.notes)).toEqual([
      [{ path: 'src/h1.ts', note: 'h1 note' }],
    ]);
  });

  it('chooses the layer that breaks no other rule', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h3', 'h1'), link('uses', 'h3', 'h2', 'Invite')]),
      cohort([layer(['h1']), layer(['h2', 'h3'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h2', 'h3', 'h1']]);
  });

  it('joins code moved both ways and along a chain', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([
        link('moves', 'h1', 'h2'),
        link('moves', 'h2', 'h1'),
        link('moves', 'h3', 'h2'),
      ]),
      cohort([layer(['h1']), layer(['h2']), layer(['h3', 'h4'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h3', 'h4', 'h1', 'h2']]);
  });

  it('points a dependency on an emptied layer at the layer that holds its hunks', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([
        layer(['h1']),
        layer(['h2', 'h3']),
        layer(
          ['h4'],
          [
            { layer: 1, because: ['A'] },
            { layer: 2, because: ['B'] },
          ],
        ),
      ]),
    );

    expect(arranged.layers.map((each) => each.dependsOn)).toEqual([
      [],
      [{ layer: 1, because: ['A', 'B'] }],
    ]);
  });

  it('keeps what an emptied layer depends on, on the layer that holds its hunks', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([
        layer(['h3']),
        layer(['h1'], [{ layer: 1, because: ['Invite'] }]),
        layer(['h2']),
      ]),
    );

    expect(hunksOf(arranged)).toEqual([['h3'], ['h2', 'h1']]);
    expect(arranged.layers[1]?.dependsOn).toEqual([
      { layer: 1, because: ['Invite'] },
    ]);
  });

  it('keeps the questions of an emptied layer on the layer that holds its hunks', () => {
    const question = asked(['h1']);
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([{ ...layer(['h1']), questions: [question] }, layer(['h2'])]),
    );

    expect(arranged.layers).toHaveLength(1);
    expect(arranged.layers[0]?.questions).toEqual([question]);
  });

  it('moves a question about moved code to the layer that shows it', () => {
    const question = asked(['h1']);
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([
        { ...layer(['h1', 'h3']), questions: [question] },
        layer(['h4']),
        layer(['h2']),
      ]),
    );

    expect(hunksOf(arranged)).toEqual([['h3'], ['h4'], ['h2', 'h1']]);
    expect(arranged.layers.map((each) => each.questions)).toEqual([
      [],
      [],
      [question],
    ]);
  });

  it('keeps a layer that was proposed without hunks, for the checks to refuse', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      cohort([layer([]), layer(['h1']), layer(['h2'])]),
    );

    expect(hunksOf(arranged)).toEqual([[], ['h2', 'h1']]);
  });

  it('leaves code moved in from another cohort to the model', () => {
    const proposed = cohort([layer(['h1'])]);

    expect(
      withMovedCodeTogether(DIFF, facts([link('moves', 'h2', 'h1')]), proposed),
    ).toBe(proposed);
  });
});
