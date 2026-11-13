import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import { stackPartsOf } from '@change-review/domain/services/stack-part';
import { withTestsBesideTheirCode } from '@change-review/domain/services/test-placement';
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

const facts = (
  links: HunkLink[],
  defines: Record<string, string[]> = {},
): DiffFacts => ({
  hunks: IDS.map((id) => ({
    hunk: HunkId.of(id),
    path: `src/${id}.ts`,
    fileClass: 'source',
    incidental: false,
    renamed: false,
    moved: false,
    linkable: true,
    defines: defines[id] ?? [],
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

const beside = (
  links: HunkLink[],
  proposed: ProposedCohort,
  layerBudget = Number.POSITIVE_INFINITY,
  defines: Record<string, string[]> = {},
) =>
  withTestsBesideTheirCode(
    stackPartsOf(DIFF, facts(links, defines)),
    proposed,
    layerBudget,
  );

describe('withTestsBesideTheirCode', () => {
  it('moves a test into the latest layer of the code it covers', () => {
    const repair = beside(
      [
        link('uses', 'h2', 'h1'),
        link('tests', 'h3', 'h1'),
        link('tests', 'h3', 'h2', 'accept'),
      ],
      cohort([
        layer(['h1', 'h3']),
        layer(['h2'], [{ layer: 1, because: ['Invite'] }]),
      ]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h1'], ['h2', 'h3']]);
  });

  it('moves a test that came before its code', () => {
    const repair = beside(
      [link('tests', 'h1', 'h2')],
      cohort([layer(['h1', 'h3']), layer(['h2'])]),
    );

    expect(hunksOf(repair.cohort)).toEqual([['h3'], ['h2', 'h1']]);
  });

  it('empties no more layers than it may', () => {
    const proposed = cohort([layer(['h1']), layer(['h2'])]);
    const links = [link('tests', 'h2', 'h1')];

    expect(beside(links, proposed, 0).cohort).toBe(proposed);
    const repair = beside(links, proposed, 1);

    expect(hunksOf(repair.cohort)).toEqual([['h1', 'h2']]);
    expect(repair.layerBudget).toBe(0);
  });

  it('leaves a proposal with any other problem to the model', () => {
    const proposed = cohort([layer(['h1', 'h3']), layer(['h2'])]);

    expect(
      beside([link('tests', 'h3', 'h2'), link('uses', 'h1', 'h2')], proposed)
        .cohort,
    ).toBe(proposed);
  });

  it('leaves a test apart rather than lose a question', () => {
    const proposed = cohort([
      {
        ...layer(['h1', 'h3']),
        questions: [
          {
            question: 'What does the test cover?',
            answer: 'The invitation.',
            hunks: [HunkId.of('h3')],
          },
        ],
      },
      {
        ...layer(['h2']),
        questions: ['One?', 'Two?'].map((question) => ({
          question,
          answer: 'The invitation.',
          hunks: [HunkId.of('h2')],
        })),
      },
    ]);

    expect(beside([link('tests', 'h3', 'h2')], proposed).cohort).toBe(proposed);
  });

  it('drops the dependency a later layer had on what a moved test defines', () => {
    const repair = beside(
      [link('tests', 'h3', 'h2')],
      cohort([
        layer(['h1', 'h3']),
        layer(['h2'], [{ layer: 1, because: ['inviteFixture'] }]),
      ]),
      Number.POSITIVE_INFINITY,
      { h3: ['inviteFixture'] },
    );

    expect(hunksOf(repair.cohort)).toEqual([['h1'], ['h2', 'h3']]);
    expect(repair.cohort.layers[1]?.dependsOn).toEqual([]);
  });

  it('changes nothing when every test sits with its code', () => {
    const proposed = cohort([layer(['h1', 'h2'])]);

    expect(beside([link('tests', 'h2', 'h1')], proposed).cohort).toBe(proposed);
  });
});
