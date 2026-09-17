import { arranged } from '@change-review/domain/services/arrange-stack';
import type {
  DiffFacts,
  FileClass,
} from '@change-review/domain/services/diff-facts';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { describe, expect, it } from 'vitest';

const file = (id: string, path: string, line: string): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id,
      oldStart: 1,
      oldLines: 1,
      newStart: 1,
      newLines: 1,
      patch: `@@ -1 +1 @@\n-before\n+${line}`,
    },
  ],
});

const factsOf = (
  diff: Diff,
  classes: Record<string, FileClass>,
): DiffFacts => ({
  hunks: diff.files.flatMap((each) =>
    each.hunks.map((hunk) => {
      const fileClass = classes[each.path] ?? 'source';

      return {
        hunk: hunk.id,
        path: each.path,
        fileClass,
        incidental: fileClass === 'lockfile' || fileClass === 'generated',
        renamed: false,
        moved: false,
        linkable: fileClass === 'source',
        defines: [],
        outside: [],
      };
    }),
  ),
  links: [],
  imports: [],
});

const DIFF = Diff.of([
  file('h1', 'src/schema.ts', 'invitation table'),
  file('h2', 'package-lock.json', '"zod": "4.4.3"'),
  file('h3', 'src/api.ts', 'POST /invitations'),
  file('h4', 'web/src/lib/api/types.gen.ts', 'export type Invite = {}'),
]);

const FACTS = factsOf(DIFF, {
  'package-lock.json': 'lockfile',
  'web/src/lib/api/types.gen.ts': 'generated',
});

const layer = (
  title: string,
  hunks: string[],
  dependsOn: ProposedLayer['dependsOn'] = [],
): ProposedLayer => ({
  title,
  summary: title,
  dependsOn,
  ranges: hunks.map((hunk) => ({ hunk })),
  notes: hunks.map((hunk) => ({
    path: DIFF.fileOf(hunk)?.path ?? hunk,
    note: `Why ${title} changes`,
  })),
});

describe('arranged', () => {
  it('sets aside incidental changes in a cohort of their own, last', () => {
    const proposed: ProposedCohort[] = [
      {
        kind: 'change',
        title: 'Invitations',
        intent: 'Invite people',
        layers: [layer('Model', ['h1']), layer('API', ['h3'])],
      },
    ];

    const cohorts = arranged(DIFF, FACTS, proposed);

    expect(cohorts).toHaveLength(2);
    expect(cohorts[1]).toMatchObject({
      kind: 'incidental',
      title: 'Update lockfiles and generated files',
    });
    expect(cohorts[1]?.layers[0]?.ranges.map((each) => each.hunk)).toEqual([
      'h2',
      'h4',
    ]);
    expect(cohorts[1]?.layers[0]?.notes).toEqual([]);
  });

  it('takes incidental changes back out of the proposal, renumbering what depends on what', () => {
    const proposed: ProposedCohort[] = [
      {
        kind: 'change',
        title: 'Invitations',
        intent: 'Invite people',
        layers: [
          layer('Lockfile', ['h2']),
          layer('Model', ['h1']),
          layer(
            'API',
            ['h3'],
            [
              { layer: 1, because: ['zod'] },
              { layer: 2, because: ['invitation'] },
            ],
          ),
        ],
      },
    ];

    const [cohort] = arranged(DIFF, FACTS, proposed);

    expect(cohort?.layers.map((each) => each.title)).toEqual(['Model', 'API']);
    expect(cohort?.layers[1]?.dependsOn).toEqual([
      { layer: 1, because: ['invitation'] },
    ]);
  });

  it('drops the notes on files whose changes it sets aside', () => {
    const proposed: ProposedCohort[] = [
      {
        kind: 'change',
        title: 'Invitations',
        intent: 'Invite people',
        layers: [layer('Model', ['h1', 'h2'])],
      },
    ];

    const [cohort] = arranged(DIFF, FACTS, proposed);

    expect(cohort?.layers[0]?.notes).toEqual([
      { path: 'src/schema.ts', note: 'Why Model changes' },
    ]);
  });

  it('leaves a proposal alone where nothing is incidental', () => {
    const plain = Diff.of([file('h1', 'src/a.ts', 'const a = 1;')]);
    const proposed: ProposedCohort[] = [
      {
        kind: 'change',
        title: 'A',
        intent: 'A',
        layers: [layer('A', ['h1'])],
      },
    ];

    expect(arranged(plain, factsOf(plain, {}), proposed)).toEqual(proposed);
  });
});
