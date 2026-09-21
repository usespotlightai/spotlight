import { AnnounceChangeStack } from '@change-review/application/services/announce-change-stack.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import type { StandingComment } from '@github/application/ports/pull-request-comments.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-16T10:00:00Z');

const ready = () =>
  ChangeStack.draft({
    id: ChangeStackId.of('stack-1'),
    runId: RunId.of('run-1'),
    taskId: null,
    workspaceId: WorkspaceId.of('workspace-1'),
    repository: null,
    base: null,
    request: null,
    diff: Diff.of([
      {
        path: 'a.ts',
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
            patch: '@@ -1 +1 @@\n-a\n+b',
          },
        ],
      },
    ]),
    facts: StackFacts.none(),
    now: NOW,
  }).propose(
    [
      {
        kind: 'change',
        title: 'Labels',
        intent: 'Labels',
        layers: [
          {
            title: 'Add labels',
            summary: 'Labels',
            dependsOn: [],
            ranges: [{ hunk: HunkId.of('h1') }],
            notes: [{ path: 'a.ts', note: 'Adds labels' }],
          },
        ],
      },
    ],
    NOW,
  );

const unreachable = async (): Promise<never> => {
  throw new Error('unreachable');
};

const announcing = (
  over: {
    pullRequest?: string | null;
    failing?: 'run' | 'task' | 'connection' | 'keep';
  } = {},
) => {
  const kept: StandingComment[] = [];
  const pullRequest =
    over.pullRequest === undefined
      ? 'https://github.com/acme/widgets/pull/66'
      : over.pullRequest;

  const announcer = new AnnounceChangeStack(
    {
      latestForTask: async () => {
        const stack = ready();

        return {
          id: stack.id.value,
          runId: stack.runId.value,
          repository: stack.repository?.value ?? null,
          state: stack.state,
          cohorts: stack.cohorts,
          check: null,
          added: 0,
          removed: 0,
        };
      },
      ofRun: async () => [],
    },
    {
      slugOf: async () => 'acme',
      mayView: async () => true,
    },
    {
      run: async () => {
        if (over.failing === 'run') {
          return unreachable();
        }

        return {
          id: RunId.of('run-1'),
          workspaceId: WorkspaceId.of('workspace-1'),
          taskId: TaskId.of('task-1'),
          request: null,
          ended: false,
        };
      },
      wasWorkedBy: async () => true,
      task: async () => {
        if (over.failing === 'task') {
          return unreachable();
        }

        return {
          id: TaskId.of('task-1'),
          workspaceId: WorkspaceId.of('workspace-1'),
          teamId: TeamId.of('team-1'),
          pullRequest: pullRequest ? PullRequestUrl.of(pullRequest) : null,
          reviewing: false,
          currentRunId: null,
        };
      },
      taskWithPullRequest: async () => null,
    },
    {
      isConnected: async () =>
        over.failing === 'connection' ? unreachable() : true,
    },
    {
      keep: async (comment) => {
        if (over.failing === 'keep') {
          await unreachable();
        }
        kept.push(comment);
      },
    },
    { now: () => NOW, sleep: async () => undefined },
    { pageOf: ({ runId }) => `https://app.example/runs/${runId}/changes` },
  );

  return { announcer, kept };
};

describe('AnnounceChangeStack', () => {
  it('keeps one comment on the task’s pull request that links its newest stack', async () => {
    const { announcer, kept } = announcing();

    await announcer.ofRun(RunId.of('run-1'));

    expect(kept).toHaveLength(1);
    expect(kept[0]?.repository.name).toBe('widgets');
    expect(kept[0]?.body).toContain('https://app.example/runs/run-1/changes');
  });

  it('says nothing while the task has no pull request', async () => {
    const { announcer, kept } = announcing({ pullRequest: null });

    await announcer.ofTask(TaskId.of('task-1'));

    expect(kept).toEqual([]);
  });

  it('lets a failure to reach Work or GitHub surface, so the delivery is tried again', async () => {
    for (const failing of ['run', 'task', 'connection', 'keep'] as const) {
      const { announcer } = announcing({ failing });

      await expect(announcer.ofRun(RunId.of('run-1'))).rejects.toThrow(
        'unreachable',
      );
    }
  });
});
