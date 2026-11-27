import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { sessionRunFor } from '@change-review/domain/services/session-run';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { commitSha } from '@change-review/domain/value-objects/commit-sha.fake-spec';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { Pusher } from '@change-review/domain/value-objects/pusher.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');

const DIFF = Diff.of([
  {
    path: 'retry.ts',
    previousPath: null,
    status: 'modified',
    binary: false,
    hunks: [
      {
        id: HunkId.of('h1'),
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        patch: '@@ -1 +1 @@\n-once\n+twice',
      },
    ],
  },
]);

const pushed = StackOrigin.push(commitSha('b'), Pusher.of('octocat'));

const stack = (
  id: string,
  origin: StackOrigin,
  repository: string,
  minutes: number,
  taskId: TaskId | null = TaskId.of('task_1'),
) =>
  ChangeStack.startGeneration({
    id: ChangeStackId.of(id),
    origin,
    taskId,
    teamOfRun: taskId ? null : TeamId.of('team_1'),
    trial: false,
    checkouts: 1,
    workspaceId: WorkspaceId.of('ws_1'),
    owner: 'acme',
    repository,
    base: null,
    diff: DIFF,
    facts: StackFacts.of({ hunks: [], links: [], imports: [] }),
    request: null,
    now: new Date(NOW.getTime() + minutes * 60_000),
  });

const ofRun = (run: string) => StackOrigin.run(RunId.of(run));

describe('the run that hosts an assist session about a stack', () => {
  it('is the stack’s own run, even where a later run of the task made a stack too', () => {
    const own = stack('stack_1', ofRun('run_1'), 'widgets', 0);
    const later = stack('stack_2', ofRun('run_2'), 'widgets', 10);

    expect(sessionRunFor(own, [own, later])?.value).toBe('run_1');
  });

  it('is the newest run of the task with a stack of the same repository, for a pushed stack', () => {
    const push = stack('stack_push', pushed, 'widgets', 20);
    const stacks = [
      stack('stack_1', ofRun('run_1'), 'widgets', 0),
      stack('stack_2', ofRun('run_2'), 'widgets', 10),
      stack('stack_docs', ofRun('run_3'), 'docs', 15),
      push,
    ];

    expect(sessionRunFor(push, stacks)?.value).toBe('run_2');
  });

  it('is no run where no stack of the task came from a run', () => {
    const push = stack('stack_push', pushed, 'widgets', 20);

    expect(sessionRunFor(push, [push])).toBeNull();
  });
});
