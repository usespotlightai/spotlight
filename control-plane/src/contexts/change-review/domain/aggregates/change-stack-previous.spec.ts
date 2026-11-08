import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-08T10:00:00Z');

const LATER = new Date('2026-11-08T11:00:00Z');

const file = (id: string, path: string, line: string): DiffFile => ({
  path,
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
      patch: `@@ -1 +1 @@\n-before\n+${line}`,
    },
  ],
});

const factsOf = (diff: Diff) =>
  StackFacts.of({
    hunks: diff.files.flatMap((each) =>
      each.hunks.map((hunk) => ({
        hunk: hunk.id,
        path: each.path,
        fileClass: 'source' as const,
        incidental: false,
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
]);

const CHANGED = Diff.of([
  file('h1', 'schema.ts', 'invitation table'),
  file('h2', 'invite.api.ts', 'POST /invitations, 409 for members'),
]);

const layerIn =
  (diff: Diff) =>
  (title: string, hunks: string[]): ProposedLayer => ({
    title,
    summary: `${title}, in more words`,
    dependsOn: [],
    hunks: hunks.map((each) => ({ hunk: HunkId.of(each) })),
    notes: hunks.map((each) => ({
      path: diff.fileOf(HunkId.of(each))?.path ?? each,
      note: 'Why it changes',
    })),
    questions: [
      {
        question: `What does ${title} change?`,
        answer: `The answer for ${title}`,
        hunks: hunks.map((each) => HunkId.of(each)),
      },
    ],
  });

const cohort = (layers: ProposedLayer[]): ProposedCohort => ({
  kind: 'change',
  title: 'Team invitations',
  intent: 'Let admins invite people',
  joinedBecause: null,
  layers,
});

const started = (
  id: string,
  diff: Diff,
  taskStacks: ChangeStack[] = [],
  over: { taskId?: TaskId | null; repository?: string } = {},
) => {
  const taskId = over.taskId === undefined ? TaskId.of('task-1') : over.taskId;

  return ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    runId: RunId.of(`run-${id}`),
    taskId,
    teamOfRun: taskId ? null : TeamId.of('team-1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: over.repository ?? 'web',
    base: null,
    diff,
    facts: factsOf(diff),
    request: null,
    taskStacks,
    now: NOW,
  });
};

const first = layerIn(FIRST);

const PREVIOUS = started('stack-1', FIRST).propose(
  [cohort([first('Model', ['h1']), first('API', ['h2'])])],
  NOW,
);

describe('ChangeStack following the previous stack', () => {
  it('follows the task’s ready stack of the same repository', () => {
    expect(started('stack-2', CHANGED, [PREVIOUS]).previous).toEqual(
      PREVIOUS.id,
    );
    expect(
      started('stack-2', CHANGED, [PREVIOUS], { repository: 'api' }).previous,
    ).toBeNull();
  });

  it('follows nothing for a team’s stack, or a stack still generating', () => {
    expect(
      started('stack-2', CHANGED, [PREVIOUS], { taskId: null }).previous,
    ).toBeNull();
    expect(
      started('stack-2', CHANGED, [started('stack-0', FIRST)]).previous,
    ).toBeNull();
  });

  describe('when drafted', () => {
    const next = layerIn(CHANGED);
    const following = () => started('stack-2', CHANGED, [PREVIOUS]);
    const drafted = [cohort([next('Model', ['h1']), next('API', ['h2'])])];

    it('is refused without the stack it follows, unless told that stack is gone', () => {
      expect(() => following().propose(drafted, LATER)).toThrow(
        'must be drafted with the stack it follows, or be told it is gone',
      );
      expect(
        following()
          .propose(drafted, LATER, { previous: null })
          .cohorts[0]?.layers.map((each) => each.revision),
      ).toEqual([null, null]);
    });

    it('is refused against a stack it does not follow', () => {
      expect(() =>
        following().propose(drafted, LATER, {
          previous: started('stack-3', FIRST).propose(
            [cohort([first('All', ['h1', 'h2'])])],
            NOW,
          ),
        }),
      ).toThrow('can be revised only against the stack it follows');
      expect(() =>
        started('stack-4', CHANGED).propose(drafted, LATER, {
          previous: PREVIOUS,
        }),
      ).toThrow('follows no previous stack');
    });

    it('marks its layers against the previous stack, keeping an unchanged layer’s questions', () => {
      const layers = following().propose(drafted, LATER, {
        previous: PREVIOUS,
      }).cohorts[0]?.layers;

      expect(layers?.map((each) => each.revision)).toEqual([
        { status: 'unchanged', previous: 'c1.l1' },
        { status: 'modified', previous: 'c1.l2' },
      ]);
      expect(layers?.[0]?.questions[0]?.question).toBe(
        'What does Model change?',
      );
    });
  });

  describe('reused', () => {
    it('takes the previous stack as it was when the diff is the same', () => {
      const reused = started('stack-2', FIRST, [PREVIOUS]).reusedFrom(
        PREVIOUS,
        LATER,
      );

      expect(reused?.state).toBe('ready');
      expect(reused?.cohorts[0]?.layers.map((each) => each.revision)).toEqual([
        { status: 'unchanged', previous: 'c1.l1' },
        { status: 'unchanged', previous: 'c1.l2' },
      ]);
      expect(reused?.removed).toEqual([]);
    });

    it('is refused for a stack that is no longer generating', () => {
      const ready = started('stack-2', FIRST, [PREVIOUS]).reusedFrom(
        PREVIOUS,
        LATER,
      );

      expect(() => ready?.reusedFrom(PREVIOUS, LATER)).toThrow(
        'is already ready',
      );
    });

    it('is nothing when a reviewed hunk changed', () => {
      expect(
        started('stack-2', CHANGED, [PREVIOUS]).reusedFrom(PREVIOUS, LATER),
      ).toBeNull();
    });
  });
});
