import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type {
  DiffFacts,
  HunkFacts,
} from '@change-review/domain/services/diff-facts';
import { StackOutline } from '@change-review/domain/services/stack-outline';
import {
  Diff,
  type DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  OutlinedCohort,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  CohortId,
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, start: number): DiffHunk => ({
  id: HunkId.of(id),
  oldStart: start,
  oldLines: 1,
  newStart: start,
  newLines: 1,
  patch: `@@ -${start} +${start} @@\n-before\n+after`,
});

const DIFF = Diff.of([
  {
    path: 'src/invite.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [hunk('h1', 1), hunk('h2', 20)],
  },
  {
    path: 'src/routes.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [hunk('h3', 1)],
  },
  {
    path: 'package-lock.json',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [hunk('h4', 1)],
  },
]);

const facts = (id: string, path: string, incidental = false): HunkFacts => ({
  hunk: HunkId.of(id),
  path,
  fileClass: incidental ? 'lockfile' : 'source',
  incidental,
  renamed: false,
  moved: false,
  linkable: !incidental,
  defines: [],
  outside: [],
});

const FACTS: DiffFacts = {
  hunks: [
    facts('h1', 'src/invite.ts'),
    facts('h2', 'src/invite.ts'),
    facts('h3', 'src/routes.ts'),
    facts('h4', 'package-lock.json', true),
  ],
  links: [
    {
      kind: 'uses',
      from: HunkId.of('h3'),
      to: HunkId.of('h1'),
      because: ['invite'],
    },
  ],
  imports: [
    { from: 'src/routes.ts', to: 'src/invite.ts' },
    { from: 'src/invite.ts', to: 'src/mail.ts' },
  ],
};

const cohort = (
  hunks: string[],
  joinedBecause: string | null = null,
): OutlinedCohort => ({
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people',
  joinedBecause,
  hunks: hunks.map((each) => HunkId.of(each)),
});

const problemsOf = (cohorts: OutlinedCohort[]): string[] => {
  try {
    StackOutline.validate({ diff: DIFF, facts: FACTS, cohorts });
    return [];
  } catch (error) {
    return error instanceof InvalidChangeStackError
      ? error.problems.map((each) => each.message)
      : [String(error)];
  }
};

describe('StackOutline', () => {
  it('takes cohorts that place every hunk once, leaving out the incidental ones Spotlight places', () => {
    const outline = StackOutline.validate({
      diff: DIFF,
      facts: FACTS,
      cohorts: [
        cohort(['h1', 'h3', 'h4']),
        { ...cohort(['h2']), joinedBecause: ' ' },
      ],
    });

    expect(outline.map((each) => each.hunks)).toEqual([['h1', 'h3'], ['h2']]);
    expect(outline[1]?.joinedBecause).toBeNull();
  });

  it('refuses cohorts that leave a hunk out, place one twice or invent one', () => {
    expect(problemsOf([cohort(['h1', 'h3', 'h3', 'h9'])])).toEqual([
      'cohort 1 names h9, which is not in the diff',
      'leaves h2 out',
      'assigns h3 2 times',
    ]);
  });

  it('refuses to part hunks the code links, and joins of unconnected hunks without a reason', () => {
    expect(problemsOf([cohort(['h1', 'h2']), cohort(['h3'])])).toEqual([
      'h3 uses invite from h1, so they belong in the same cohort',
      'cohort 1 joins hunks the code does not connect (h1 | h2) without saying why',
    ]);
    expect(problemsOf([cohort(['h1', 'h2', 'h3'], 'One feature')])).toEqual([]);
  });

  it('parts out a cohort’s own hunks, links and imports', () => {
    const part = StackOutline.partOf(DIFF, FACTS, [
      HunkId.of('h1'),
      HunkId.of('h3'),
    ]);

    expect(part.diff.files.map((file) => file.path)).toEqual([
      'src/invite.ts',
      'src/routes.ts',
    ]);
    expect(part.diff.hunks.map((each) => each.id)).toEqual(['h1', 'h3']);
    expect(part.facts.hunks.map((each) => each.hunk)).toEqual(['h1', 'h3']);
    expect(part.facts.links).toHaveLength(1);
    expect(part.facts.imports).toEqual([
      { from: 'src/routes.ts', to: 'src/invite.ts' },
    ]);
  });

  it('layers a cohort only with layers that place exactly its own hunks', () => {
    const outlined = cohort(['h1', 'h3']);
    const part = StackOutline.partOf(DIFF, FACTS, outlined.hunks);
    const layer = {
      title: 'Add invitations',
      summary: 'The function and its route',
      dependsOn: [],
      hunks: [{ hunk: HunkId.of('h1') }, { hunk: HunkId.of('h3') }],
      notes: [
        { path: 'src/invite.ts', note: 'Adds the function.' },
        { path: 'src/routes.ts', note: 'Mounts it.' },
      ],
    };

    expect(StackOutline.layered(part, outlined, [layer])).toEqual({
      kind: 'change',
      title: 'Team invitations',
      intent: 'Let admins invite people',
      joinedBecause: null,
      layers: [layer],
    });
    expect(() =>
      StackOutline.layered(part, outlined, [
        { ...layer, hunks: [...layer.hunks, { hunk: HunkId.of('h2') }] },
      ]),
    ).toThrow('h2, which is not in the diff');
  });

  it('keeps a stored cohort as the proposal it came from', () => {
    const c1 = CohortId.at(1);
    const stored: StackCohort = {
      id: c1,
      kind: 'change',
      title: 'Team invitations',
      intent: 'Let admins invite people',
      joinedBecause: 'One feature',
      layers: [1, 2].map((place) => ({
        id: LayerId.in(c1, place),
        title: `Layer ${place}`,
        summary: `Layer ${place}`,
        dependsOn:
          place === 2
            ? [{ layer: LayerId.in(c1, 1), because: ['invite'] }]
            : [],
        hunks: [{ hunk: HunkId.at(place) }],
        notes: [{ path: 'src/invite.ts', note: 'Why it changes' }],
      })),
    };

    expect(StackOutline.of(stored).hunks).toEqual(['h1', 'h2']);
    expect(StackOutline.kept(stored)).toMatchObject({
      joinedBecause: 'One feature',
      layers: [
        { dependsOn: [] },
        { dependsOn: [{ layer: 1, because: ['invite'] }] },
      ],
    });
  });
});
