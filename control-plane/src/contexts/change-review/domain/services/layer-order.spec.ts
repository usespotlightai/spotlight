import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import { withLayersInOrder } from '@change-review/domain/services/layer-order';
import { stackPartsOf } from '@change-review/domain/services/stack-part';
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
  because = 'Invite',
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
  joinedBecause: 'One feature',
  layers,
});

const hunksOf = (each: ProposedCohort) =>
  each.layers.map((one) => one.hunks.map((entry) => entry.hunk));

const ordered = (
  links: HunkLink[],
  proposed: ProposedCohort,
  layerBudget = Number.POSITIVE_INFINITY,
) => withLayersInOrder(stackPartsOf(DIFF, facts(links)), proposed, layerBudget);

describe('withLayersInOrder', () => {
  it('puts a layer after the layer of the code it uses', () => {
    const repair = ordered(
      [link('uses', 'h1', 'h2')],
      cohort([layer(['h1', 'h3']), layer(['h2'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h2'], ['h1', 'h3']]);
  });

  it('puts a layer that removes what a later layer stops using after it', () => {
    const repair = ordered(
      [link('removes', 'h1', 'h2')],
      cohort([layer(['h1', 'h3']), layer(['h2'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h2'], ['h1', 'h3']]);
  });

  it('keeps the layers that depend on a moved layer after it', () => {
    const repair = ordered(
      [link('uses', 'h1', 'h2')],
      cohort([
        layer(['h1', 'h3']),
        layer(['h4'], [{ layer: 1, because: ['inviteForm'] }]),
        layer(['h2']),
      ]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h2'], ['h1', 'h3'], ['h4']]);
    expect(repair.cohort.layers[2]?.dependsOn).toEqual([
      { layer: 2, because: ['inviteForm'] },
    ]);
  });

  it('pulls what a hunk uses back into its layer when the layers depend on each other', () => {
    const repair = ordered(
      [link('uses', 'h1', 'h2'), link('uses', 'h4', 'h3')],
      cohort([layer(['h1', 'h3']), layer(['h2', 'h4'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h1', 'h3', 'h2'], ['h4']]);
  });

  it('pulls back what the pulled hunks use too', () => {
    const repair = ordered(
      [
        link('uses', 'h1', 'h2'),
        link('uses', 'h4', 'h1'),
        link('uses', 'h3', 'h4'),
      ],
      cohort([layer(['h1', 'h4']), layer(['h2', 'h3'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h1', 'h4', 'h2'], ['h3']]);
  });

  it('empties no more layers than it may', () => {
    const proposed = cohort([layer(['h1']), layer(['h2'])]);
    const links = [link('uses', 'h1', 'h2'), link('uses', 'h2', 'h1')];

    expect(ordered(links, proposed, 0).cohort).toBe(proposed);
    expect(hunksOf(ordered(links, proposed, 1).cohort)).toEqual([['h1', 'h2']]);
  });

  it('puts a test back into the layer of the code it covers', () => {
    const repair = ordered(
      [link('tests', 'h1', 'h2')],
      cohort([layer(['h2']), layer(['h3']), layer(['h1'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h2', 'h1'], ['h3']]);
  });

  it('leaves code that is only moved apart to the moved-code repair', () => {
    const proposed = cohort([layer(['h1']), layer(['h2'])]);

    expect(ordered([link('moves', 'h2', 'h1')], proposed).cohort).toBe(
      proposed,
    );
  });

  it('leaves a proposal with any other problem to the model', () => {
    const proposed = cohort([
      { ...layer(['h1', 'h3']), title: '' },
      layer(['h2']),
    ]);

    expect(ordered([link('uses', 'h1', 'h2')], proposed).cohort).toBe(proposed);
  });

  it('changes nothing when every hunk comes after what it uses', () => {
    const proposed = cohort([layer(['h2']), layer(['h1'])]);

    expect(ordered([link('uses', 'h1', 'h2')], proposed).cohort).toBe(proposed);
  });
});
