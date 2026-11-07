import type {
  DiffFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import {
  movedGroups,
  withMovedCodeTogether,
} from '@change-review/domain/services/moved-code';
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

const asked = (
  hunks: string[],
  question = `What does ${hunks.join(' and ')} show?`,
) => ({
  question,
  answer: 'The invitation flow.',
  hunks: hunks.map((each) => HunkId.of(each)),
});

const together = (
  links: HunkLink[],
  proposed: ProposedCohort,
  layerBudget = Number.POSITIVE_INFINITY,
) =>
  withMovedCodeTogether(
    stackPartsOf(DIFF, facts(links)),
    movedGroups(facts(links)),
    proposed,
    layerBudget,
  ).cohort;

describe('withMovedCodeTogether', () => {
  it('chooses the layer that breaks no other rule', () => {
    const arranged = together(
      [link('moves', 'h3', 'h1'), link('uses', 'h3', 'h2', 'Invite')],
      cohort([layer(['h1']), layer(['h2', 'h3'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h2', 'h3', 'h1']]);
  });

  it('chooses the layer that keeps the most layers when two break no rule', () => {
    const arranged = together(
      [
        link('moves', 'h2', 'h3'),
        link('uses', 'h2', 'h1', 'Invite'),
        link('uses', 'h4', 'h3', 'Invite'),
      ],
      cohort([layer(['h1']), layer(['h2']), layer(['h3', 'h4'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h1'], ['h2', 'h3'], ['h4']]);
  });

  it('joins code moved both ways and along a chain', () => {
    const arranged = together(
      [
        link('moves', 'h1', 'h2'),
        link('moves', 'h2', 'h1'),
        link('moves', 'h3', 'h2'),
        link('uses', 'h4', 'h3', 'Invite'),
      ],
      cohort([layer(['h1']), layer(['h2']), layer(['h3', 'h4'])]),
    );

    expect(hunksOf(arranged)).toEqual([['h2', 'h1', 'h3'], ['h4']]);
  });

  it('empties no more layers than it may', () => {
    const proposed = cohort([layer(['h1']), layer(['h2'])]);

    expect(together([link('moves', 'h2', 'h1')], proposed, 0)).toBe(proposed);
    expect(
      withMovedCodeTogether(
        stackPartsOf(DIFF, facts([link('moves', 'h2', 'h1')])),
        movedGroups(facts([link('moves', 'h2', 'h1')])),
        proposed,
        1,
      ).layerBudget,
    ).toBe(0);
  });

  it('leaves moved code apart rather than lose a question', () => {
    const proposed = cohort([
      {
        ...layer(['h1']),
        questions: [asked(['h1'], 'One?'), asked(['h1'], 'Two?')],
      },
      { ...layer(['h2']), questions: [asked(['h2'], 'Three?')] },
    ]);

    expect(together([link('moves', 'h2', 'h1')], proposed)).toBe(proposed);
  });

  it('leaves moved code apart rather than put a layer before a layer it depends on', () => {
    const proposed = cohort([
      layer(['h1']),
      layer(['h2'], [{ layer: 1, because: ['X'] }]),
      layer(['h3', 'h4']),
    ]);

    expect(
      together(
        [
          link('moves', 'h3', 'h1'),
          link('uses', 'h3', 'h2', 'Invite'),
          link('uses', 'h4', 'h3', 'Invite'),
        ],
        proposed,
      ),
    ).toBe(proposed);
  });

  it('leaves a proposal with any other problem to the model', () => {
    const links = [
      link('moves', 'h2', 'h1'),
      link('uses', 'h3', 'h1', 'Invite'),
    ];
    const proposals = [
      cohort([{ ...layer(['h1']), title: '' }, layer(['h2', 'h3'])]),
      cohort([
        {
          ...layer(['h1']),
          notes: [{ path: 'src/h4.ts', note: 'Not here' }],
        },
        layer(['h2', 'h3']),
      ]),
      cohort([
        layer(['h1']),
        layer(['h2', 'h3'], [{ layer: 3, because: ['Y'] }]),
      ]),
      cohort([
        layer(['h1']),
        {
          ...layer(['h2', 'h3']),
          notes: [
            ...layer(['h2', 'h3']).notes,
            { path: 'src/h3.ts', note: 'Again' },
          ],
        },
      ]),
    ];

    for (const proposed of proposals) {
      expect(together(links, proposed)).toBe(proposed);
    }
  });

  it('keeps every question it showed, not only as many', () => {
    const proposed = cohort([
      {
        ...layer(['h1', 'h3']),
        questions: [
          asked(['h2'], 'Early?'),
          asked(['h1'], 'One?'),
          asked(['h3'], 'Two?'),
        ],
      },
      layer(['h2']),
    ]);

    expect(
      together(
        [link('moves', 'h2', 'h1'), link('uses', 'h3', 'h1', 'Invite')],
        proposed,
      ),
    ).toBe(proposed);
  });

  it('puts several moved groups together, keeping the most layers', () => {
    const arranged = together(
      [
        link('moves', 'h2', 'h1'),
        link('moves', 'h4', 'h3'),
        link('uses', 'h4', 'h1', 'Invite'),
        link('uses', 'h3', 'h1', 'Invite'),
      ],
      cohort([layer(['h1', 'h3']), layer(['h2', 'h4'])]),
    );

    expect(hunksOf(arranged)).toEqual([
      ['h1', 'h2'],
      ['h4', 'h3'],
    ]);
  });

  it('leaves a hunk the model placed twice to the checks', () => {
    const proposed = cohort([
      layer(['h1']),
      layer(['h1', 'h2']),
      layer(['h3', 'h4']),
    ]);

    expect(together([link('moves', 'h3', 'h1')], proposed)).toBe(proposed);
  });

  it('leaves many split moved groups to the model without trying every place', () => {
    const count = 30;
    const many = Diff.of(
      Array.from({ length: count * 2 }, (_, at) => file(`h1${at}`)),
    );
    const links = Array.from({ length: count }, (_, at) =>
      link('moves', `h1${count + at}`, `h1${at}`),
    );
    const removed = Array.from({ length: count }, (_, at) => `h1${at}`);
    const added = Array.from({ length: count }, (_, at) => `h1${count + at}`);
    const proposed = cohort([layer(removed), layer(added)]);
    const started = performance.now();

    expect(
      withMovedCodeTogether(
        stackPartsOf(many, { ...facts(links), hunks: [] }),
        movedGroups(facts(links)),
        proposed,
        9,
      ).cohort,
    ).toBe(proposed);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('leaves code moved in from another cohort to the model', () => {
    const proposed = cohort([layer(['h1'])]);

    expect(together([link('moves', 'h2', 'h1')], proposed)).toBe(proposed);
  });
});
