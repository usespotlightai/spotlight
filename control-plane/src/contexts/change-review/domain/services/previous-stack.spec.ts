import {
  PreviousStack,
  type StackSnapshot,
} from '@change-review/domain/services/previous-stack';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  ProposedCohort,
  ProposedLayer,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import {
  CohortId,
  HunkId,
  LayerId,
  QuestionId,
} from '@change-review/domain/value-objects/stack-ids';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const file = (id: string, path: string, line: string, at = 1): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: [
    {
      id: HunkId.of(id),
      oldStart: at,
      oldLines: 1,
      newStart: at,
      newLines: 1,
      patch: `@@ -${at} +${at} @@\n-before\n+${line}`,
    },
  ],
});

const factsOf = (diff: Diff, incidental: readonly string[] = []) =>
  StackFacts.of({
    hunks: diff.files.flatMap((each) =>
      each.hunks.map((hunk) => ({
        hunk: hunk.id,
        path: each.path,
        fileClass: incidental.includes(each.path)
          ? ('lockfile' as const)
          : ('source' as const),
        incidental: incidental.includes(each.path),
        renamed: false,
        moved: false,
        linkable: false,
        defines: [],
        outside: [],
      })),
    ),
    links: [],
    imports: [],
  });

const FIRST = Diff.of([
  file('h1', 'schema.ts', 'invitation table'),
  file('h2', 'invite.api.ts', 'POST /invitations'),
  file('h3', 'Invite.tsx', 'invite form'),
]);

const NEXT = Diff.of([
  file('h1', 'audit.ts', 'audit log'),
  file('h2', 'schema.ts', 'invitation table'),
  file('h3', 'invite.api.ts', 'POST /invitations, 409 for members'),
  file('h4', 'Invite.tsx', 'invite form'),
]);

const C1 = CohortId.at(1);

const storedLayer = (
  place: number,
  title: string,
  hunks: string[],
  questions: { question: string; hunks: string[] }[] = [],
) => {
  const id = LayerId.in(C1, place);

  return {
    id,
    title,
    summary: `${title}, in more words`,
    dependsOn: [],
    hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
    notes: [],
    questions: questions.map((each, q) => ({
      id: QuestionId.in(id, q + 1),
      question: each.question,
      answer: `The answer to ${each.question}`,
      hunks: each.hunks.map((hunk) => HunkId.of(hunk)),
    })),
    revision: null,
  };
};

const INVITATIONS: StackCohort = {
  id: C1,
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people',
  joinedBecause: null,
  layers: [
    storedLayer(1, 'Model', ['h1']),
    storedLayer(
      2,
      'API',
      ['h2'],
      [{ question: 'Who may invite?', hunks: ['h1', 'h2'] }],
    ),
    storedLayer(
      3,
      'UI',
      ['h3'],
      [{ question: 'What does the form show?', hunks: ['h3'] }],
    ),
  ],
};

const snapshot = (over: Partial<StackSnapshot> = {}): StackSnapshot => ({
  id: ChangeStackId.of('stack-1'),
  taskId: TaskId.of('task-1'),
  repository: RepositoryName.of('web'),
  state: 'ready',
  redrafting: false,
  startedAt: new Date('2026-11-08T10:00:00Z'),
  diff: FIRST,
  facts: factsOf(FIRST),
  cohorts: [INVITATIONS],
  ...over,
});

const PREVIOUS = snapshot();

const layer = (hunks: string[]): ProposedLayer => ({
  title: hunks.join('+'),
  summary: 'A layer',
  dependsOn: [],
  hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
  notes: [],
  questions: [
    { question: 'A new question?', answer: 'Yes.', hunks: [HunkId.of('h1')] },
  ],
});

const proposed = (...layers: string[][]): ProposedCohort[] => [
  {
    kind: 'change',
    title: 'Team invitations',
    intent: 'Let admins invite people',
    joinedBecause: null,
    layers: layers.map(layer),
  },
];

describe('PreviousStack', () => {
  describe('chosen from a task’s earlier stacks', () => {
    const NEW = {
      id: ChangeStackId.of('stack-9'),
      taskId: TaskId.of('task-1'),
      repository: RepositoryName.of('web'),
    };
    const at = (iso: string, over: Partial<StackSnapshot> = {}) =>
      snapshot({
        id: ChangeStackId.of(`stack-${iso}`),
        startedAt: new Date(iso),
        ...over,
      });

    it('is the latest ready stack of the same task and repository', () => {
      const latest = at('2026-11-08T12:00:00Z');

      expect(
        PreviousStack.chosenFrom(
          [
            at('2026-11-08T11:00:00Z'),
            latest,
            at('2026-11-08T13:00:00Z', { state: 'failed' }),
            at('2026-11-08T14:00:00Z', { redrafting: true }),
            at('2026-11-08T15:00:00Z', {
              repository: RepositoryName.of('api'),
            }),
            at('2026-11-08T16:00:00Z', { taskId: TaskId.of('task-2') }),
          ],
          NEW,
        ),
      ).toBe(latest);
    });

    it('is nothing for a stack without a task, or for the stack itself', () => {
      expect(
        PreviousStack.chosenFrom([PREVIOUS], { ...NEW, taskId: null }),
      ).toBeNull();
      expect(
        PreviousStack.chosenFrom([PREVIOUS], { ...NEW, id: PREVIOUS.id }),
      ).toBeNull();
    });
  });

  describe('of a new diff', () => {
    const previous = PreviousStack.of(PREVIOUS, {
      diff: NEXT,
      facts: factsOf(NEXT),
    });

    it('names the earlier hunks by their ids in the new diff', () => {
      expect(
        previous.cohorts[0]?.layers.map((each) => ({
          hunks: each.hunks,
          fullyKept: each.fullyKept,
        })),
      ).toEqual([
        { hunks: ['h2'], fullyKept: true },
        { hunks: [], fullyKept: false },
        { hunks: ['h4'], fullyKept: true },
      ]);
      expect(previous.addedHunks).toEqual(['h1', 'h3']);
      expect(previous.diffUnchanged).toBe(false);
    });

    it('keeps only the questions whose cited hunks are all still there', () => {
      expect(
        previous.cohorts[0]?.layers.map((each) =>
          each.questions.map((q) => q.hunks),
        ),
      ).toEqual([[], [], [['h4']]]);
    });

    it('sees the diff unchanged when no reviewed hunk changed, even with a new lockfile', () => {
      const withLock = Diff.of([
        ...FIRST.files,
        file('h4', 'package-lock.json', 'pg 8.13.2'),
      ]);

      expect(
        PreviousStack.of(PREVIOUS, {
          diff: withLock,
          facts: factsOf(withLock, ['package-lock.json']),
        }).diffUnchanged,
      ).toBe(true);
      expect(
        PreviousStack.reusedCohorts(
          PreviousStack.of(PREVIOUS, { diff: FIRST, facts: factsOf(FIRST) }),
        )[0]?.layers.map((each) => each.hunks),
      ).toEqual([[{ hunk: 'h1' }], [{ hunk: 'h2' }], [{ hunk: 'h3' }]]);
    });
  });

  describe('revising new layers', () => {
    const previous = PreviousStack.of(PREVIOUS, {
      diff: NEXT,
      facts: factsOf(NEXT),
    });

    it('marks each layer unchanged, modified or added, and keeps an unchanged layer’s questions', () => {
      const { cohorts, revisions } = PreviousStack.revised(
        previous,
        proposed(['h2'], ['h3'], ['h4'], ['h1']),
      );

      expect(revisions[0]).toEqual([
        { status: 'unchanged', previous: 'c1.l1' },
        { status: 'modified', previous: 'c1.l2' },
        { status: 'unchanged', previous: 'c1.l3' },
        { status: 'added' },
      ]);
      expect(cohorts[0]?.layers[2]?.questions).toEqual([
        {
          question: 'What does the form show?',
          answer: 'The answer to What does the form show?',
          hunks: ['h4'],
        },
      ]);
      expect(cohorts[0]?.layers[0]?.questions).toEqual([]);
    });

    it('marks a layer added, not modified, when its file’s earlier layer came through whole', () => {
      const grown = Diff.of([
        ...FIRST.files,
        file('h4', 'schema.ts', 'audit table', 40),
      ]);
      const { revisions } = PreviousStack.revised(
        PreviousStack.of(PREVIOUS, { diff: grown, facts: factsOf(grown) }),
        proposed(['h1'], ['h2'], ['h3'], ['h4']),
      );

      expect(revisions[0]?.map((each) => each.status)).toEqual([
        'unchanged',
        'unchanged',
        'unchanged',
        'added',
      ]);
    });
  });

  describe('removed layers', () => {
    const previous = PreviousStack.of(PREVIOUS, {
      diff: NEXT,
      facts: factsOf(NEXT),
    });
    const stored = (revisions: StackCohort['layers'][number]['revision'][]) =>
      [
        {
          ...INVITATIONS,
          layers: revisions.map((revision, at) => ({
            ...storedLayer(at + 1, `Layer ${at + 1}`, []),
            hunks:
              at === 0
                ? ['h1', 'h2', 'h3', 'h4'].map((hunk) => ({
                    hunk: HunkId.of(hunk),
                  }))
                : [],
            revision,
          })),
        },
      ] satisfies StackCohort[];

    it('are the earlier layers whose code is gone, not the ones merged into another', () => {
      expect(
        PreviousStack.removedFrom(
          previous,
          stored([{ status: 'modified', previous: LayerId.of('c1.l1') }]),
        ),
      ).toEqual([
        { previous: 'c1.l2', cohort: 'Team invitations', title: 'API' },
      ]);
    });
  });
});
