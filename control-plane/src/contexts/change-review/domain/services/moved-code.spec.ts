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

const hunksOf = (cohorts: readonly ProposedCohort[]) =>
  cohorts.map((each) =>
    each.layers.map((one) => one.hunks.map((entry) => entry.hunk)),
  );

describe('withMovedCodeTogether', () => {
  it('puts moved code in one layer and keeps the note on its file', () => {
    const [arranged] = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h3', 'h1'), link('uses', 'h2', 'h1', 'Invite')]),
      [cohort([layer(['h1', 'h2']), layer(['h3'])])],
    );

    expect(hunksOf(arranged ? [arranged] : [])).toEqual([[['h1', 'h2', 'h3']]]);
    expect(arranged?.layers[0]?.notes.map((each) => each.path)).toEqual([
      'src/h1.ts',
      'src/h2.ts',
      'src/h3.ts',
    ]);
  });

  it('chooses the layer that breaks no other rule', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h3', 'h1'), link('uses', 'h3', 'h2', 'Invite')]),
      [cohort([layer(['h1']), layer(['h2', 'h3'])])],
    );

    expect(hunksOf(arranged)).toEqual([[['h2', 'h3', 'h1']]]);
  });

  it('joins code moved both ways and along a chain', () => {
    const arranged = withMovedCodeTogether(
      DIFF,
      facts([
        link('moves', 'h1', 'h2'),
        link('moves', 'h2', 'h1'),
        link('moves', 'h3', 'h2'),
      ]),
      [cohort([layer(['h1']), layer(['h2']), layer(['h3', 'h4'])])],
    );

    expect(hunksOf(arranged)).toEqual([[['h3', 'h4', 'h1', 'h2']]]);
  });

  it('renumbers what later layers depend on when a layer empties', () => {
    const [arranged] = withMovedCodeTogether(
      DIFF,
      facts([link('moves', 'h2', 'h1')]),
      [
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
      ],
    );

    expect(arranged?.layers.map((each) => each.dependsOn)).toEqual([
      [],
      [{ layer: 1, because: ['B'] }],
    ]);
  });

  it('leaves moved code across cohorts to the model', () => {
    const cohorts = [cohort([layer(['h1'])]), cohort([layer(['h2'])])];

    expect(
      hunksOf(
        withMovedCodeTogether(
          DIFF,
          facts([link('moves', 'h2', 'h1')]),
          cohorts,
        ),
      ),
    ).toEqual(hunksOf(cohorts));
  });
});
