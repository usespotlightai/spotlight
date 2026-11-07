import {
  withHunksMovedInto,
  withoutHunks,
} from '@change-review/domain/services/cohort-hunks';
import {
  Diff,
  type DiffFile,
  type DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, start = 1): DiffHunk => ({
  id: HunkId.of(id),
  oldStart: start,
  oldLines: 1,
  newStart: start,
  newLines: 1,
  patch: `@@ -${start} +${start} @@\n-before\n+${id}`,
});

const file = (path: string, hunks: DiffHunk[]): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks,
});

const DIFF = Diff.of([
  file('src/a.ts', [hunk('h1'), hunk('h2', 20)]),
  file('src/b.ts', [hunk('h3')]),
  file('src/c.ts', [hunk('h4')]),
  file('src/d.ts', [hunk('h5')]),
]);

const ids = (hunks: string[]) => hunks.map((each) => HunkId.of(each));

const layer = (
  hunks: string[],
  over: Partial<ProposedLayer> = {},
): ProposedLayer => ({
  title: `Layer of ${hunks.join(', ')}`,
  summary: 'A layer',
  dependsOn: [],
  hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
  notes: [
    ...new Set(
      hunks.flatMap((each) => DIFF.fileOf(HunkId.of(each))?.path ?? []),
    ),
  ].map((path) => ({ path, note: `${hunks.join(', ')} change ${path}` })),
  questions: [],
  ...over,
});

const cohort = (layers: ProposedLayer[]): ProposedCohort => ({
  kind: 'change',
  title: 'A cohort',
  intent: 'A cohort',
  layers,
});

const asked = (hunks: string[], question = 'What does it show?') => ({
  question,
  answer: 'The invitation flow.',
  hunks: ids(hunks),
});

const hunksOf = (each: ProposedCohort | null) =>
  each?.layers.map((one) => one.hunks.map((entry) => entry.hunk));

describe('withoutHunks', () => {
  it('takes hunks out with their notes and the citations of them', () => {
    const left = withoutHunks(
      DIFF,
      cohort([
        layer(['h1', 'h3'], {
          questions: [asked(['h1', 'h3']), asked(['h3'], 'Only h3?')],
        }),
      ]),
      ids(['h3']),
    );

    expect(left?.layers).toEqual([
      layer(['h1', 'h3'], {
        hunks: [{ hunk: HunkId.of('h1') }],
        notes: [{ path: 'src/a.ts', note: 'h1, h3 change src/a.ts' }],
        questions: [asked(['h1'])],
      }),
    ]);
  });

  it('drops a layer it empties and what depends on it, and renumbers the rest', () => {
    const left = withoutHunks(
      DIFF,
      cohort([
        layer(['h3']),
        layer(['h1']),
        layer(['h4'], {
          dependsOn: [
            { layer: 1, because: ['zod'] },
            { layer: 2, because: ['Invite'] },
          ],
        }),
      ]),
      ids(['h3']),
    );

    expect(hunksOf(left)).toEqual([['h1'], ['h4']]);
    expect(left?.layers[1]?.dependsOn).toEqual([
      { layer: 1, because: ['Invite'] },
    ]);
  });

  it('keeps a layer that was proposed without hunks, for the checks to refuse', () => {
    expect(
      hunksOf(
        withoutHunks(
          DIFF,
          cohort([layer([]), layer(['h1', 'h3'])]),
          ids(['h3']),
        ),
      ),
    ).toEqual([[], ['h1']]);
  });

  it('leaves every dependency as written when nothing goes', () => {
    const proposed = cohort([
      layer(['h1']),
      layer(['h3'], {
        dependsOn: [
          { layer: 10, because: ['Far'] },
          { layer: 0, because: ['None'] },
          { layer: 1.5, because: ['Half'] },
        ],
      }),
    ]);

    expect(withoutHunks(DIFF, proposed, [])?.layers).toEqual(proposed.layers);
  });

  it('leaves nothing of a cohort whose hunks all go', () => {
    expect(withoutHunks(DIFF, cohort([layer(['h3'])]), ids(['h3']))).toBeNull();
  });
});

describe('withHunksMovedInto', () => {
  it('moves the hunks and the note on their file into the layer', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h3']), layer(['h4'])]),
      ids(['h4']),
      0,
    );

    expect(moved?.layers).toEqual([
      layer(['h3'], {
        hunks: ids(['h3', 'h4']).map((each) => ({ hunk: each })),
        notes: [
          { path: 'src/b.ts', note: 'h3 change src/b.ts' },
          { path: 'src/c.ts', note: 'h4 change src/c.ts' },
        ],
      }),
    ]);
  });

  it('writes no note for a moved file that had none', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h3']), layer(['h4'], { notes: [] })]),
      ids(['h4']),
      0,
    );

    expect(moved?.layers[0]?.notes.map((each) => each.path)).toEqual([
      'src/b.ts',
    ]);
  });

  it('joins the notes on a file that code moves within', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h1']), layer(['h2', 'h3'])]),
      ids(['h1']),
      1,
    );

    expect(moved?.layers[0]?.notes).toEqual([
      {
        path: 'src/a.ts',
        note: 'h2, h3 change src/a.ts\n\nh1 change src/a.ts',
      },
      { path: 'src/b.ts', note: 'h2, h3 change src/b.ts' },
    ]);
  });

  it('keeps a note in place while its layer still changes the file, and copies it nowhere', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h1', 'h2']), layer(['h3'])]),
      ids(['h2']),
      1,
    );

    expect(moved?.layers.map((each) => each.notes)).toEqual([
      [{ path: 'src/a.ts', note: 'h1, h2 change src/a.ts' }],
      [{ path: 'src/b.ts', note: 'h3 change src/b.ts' }],
    ]);
  });

  it('points a dependency on an emptied layer at the layer that holds its hunks', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h3']),
        layer(['h4', 'h5']),
        layer(['h1'], {
          dependsOn: [
            { layer: 1, because: ['A'] },
            { layer: 2, because: ['B'] },
          ],
        }),
      ]),
      ids(['h3']),
      1,
    );

    expect(moved?.layers.map((each) => each.dependsOn)).toEqual([
      [],
      [{ layer: 1, because: ['A', 'B'] }],
    ]);
  });

  it('keeps what an emptied layer depends on, unless it would point forward', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h4']),
        layer(['h3'], { dependsOn: [{ layer: 1, because: ['Invite'] }] }),
        layer(['h5'], { dependsOn: [{ layer: 2, because: ['Team'] }] }),
      ]),
      ids(['h3']),
      2,
    );

    expect(hunksOf(moved)).toEqual([['h4'], ['h5', 'h3']]);
    expect(moved?.layers[1]?.dependsOn).toEqual([
      { layer: 1, because: ['Invite'] },
    ]);
  });

  it('keeps the questions of an emptied layer on the layer that holds its hunks', () => {
    const question = asked(['h3']);
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h3'], { questions: [question] }), layer(['h4'])]),
      ids(['h3']),
      1,
    );

    expect(moved?.layers[0]?.questions).toEqual([question]);
  });

  it('moves a question about moved code to the layer that shows it', () => {
    const question = asked(['h3']);
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h3', 'h4'], { questions: [question] }), layer(['h5'])]),
      ids(['h3']),
      1,
    );

    expect(moved?.layers.map((each) => each.questions)).toEqual([
      [],
      [question],
    ]);
  });

  it('puts a moved question on the first layer that shows every hunk it cites', () => {
    const question = asked(['h3', 'h4']);
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h1']),
        layer(['h4']),
        layer(['h3'], { questions: [question] }),
      ]),
      ids(['h3']),
      0,
    );

    expect(hunksOf(moved)).toEqual([['h1', 'h3'], ['h4']]);
    expect(moved?.layers.map((each) => each.questions)).toEqual([
      [],
      [question],
    ]);
  });

  it('puts a moved question on a later layer when the layer is full', () => {
    const questions = [asked(['h1'], 'One?'), asked(['h1'], 'Two?')];
    const third = asked(['h3'], 'Three?');
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h1'], { questions }),
        layer(['h4']),
        layer(['h3'], { questions: [third] }),
      ]),
      ids(['h3']),
      0,
    );

    expect(moved?.layers.map((each) => each.questions)).toEqual([
      questions,
      [third],
    ]);
  });

  it('adds the summary of a layer it empties to the layer that holds its hunks', () => {
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h3'], { summary: 'Adds the route.' }),
        layer(['h4'], { summary: 'Moves invite into its own file.' }),
      ]),
      ids(['h4']),
      0,
    );

    expect(moved?.layers.map((each) => each.summary)).toEqual([
      'Adds the route. Moves invite into its own file.',
    ]);
  });

  it('refuses a move that puts a layer before a layer it depends on', () => {
    expect(
      withHunksMovedInto(
        DIFF,
        cohort([
          layer(['h3']),
          layer(['h4'], { dependsOn: [{ layer: 1, because: ['Invite'] }] }),
          layer(['h5']),
        ]),
        ids(['h3']),
        2,
      ),
    ).toBeNull();
  });

  it('keeps every note the layer had, even two on one file', () => {
    const twice = [
      { path: 'src/b.ts', note: 'First' },
      { path: 'src/b.ts', note: 'Second' },
    ];
    const moved = withHunksMovedInto(
      DIFF,
      cohort([layer(['h3'], { notes: twice }), layer(['h4'])]),
      ids(['h4']),
      0,
    );

    expect(moved?.layers[0]?.notes).toEqual([
      ...twice,
      { path: 'src/c.ts', note: 'h4 change src/c.ts' },
    ]);
  });

  it('refuses to move hunks past a layer that depends on the layer they leave', () => {
    expect(
      withHunksMovedInto(
        DIFF,
        cohort([
          layer(['h1', 'h3']),
          layer(['h4'], { dependsOn: [{ layer: 1, because: ['Invite'] }] }),
          layer(['h5']),
        ]),
        ids(['h1']),
        2,
      ),
    ).toBeNull();
    expect(
      withHunksMovedInto(
        DIFF,
        cohort([
          layer(['h3']),
          layer(['h4']),
          layer(['h1', 'h5'], { dependsOn: [{ layer: 2, because: ['Team'] }] }),
        ]),
        ids(['h1']),
        0,
      ),
    ).toBeNull();
  });

  it('refuses a move that leaves the target or a later layer depending on the layer the hunks leave', () => {
    for (const dependent of [1, 2]) {
      const layers = [layer(['h1', 'h3']), layer(['h4']), layer(['h5'])].map(
        (each, at) =>
          at === dependent
            ? { ...each, dependsOn: [{ layer: 1, because: ['Foo'] }] }
            : each,
      );

      expect(
        withHunksMovedInto(DIFF, cohort(layers), ids(['h1']), 1),
      ).toBeNull();
    }
  });

  it('shows no question that was hidden before the move', () => {
    const hidden = asked(['h1', 'h4'], 'Hidden?');
    const moved = withHunksMovedInto(
      DIFF,
      cohort([
        layer(['h1'], { questions: [hidden] }),
        layer(['h3']),
        layer(['h4']),
      ]),
      ids(['h1']),
      2,
    );

    expect(moved?.layers.flatMap((each) => each.questions)).toEqual([]);
  });
});
