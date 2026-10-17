import { AnnounceChangeStack } from '@change-review/application/services/announce-change-stack.service';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import type { StickyComment } from '@github/application/ports/pull-request-comments.port';
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
    replay: false,
    isSearch: false,
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
    failing?: 'run' | 'task' | 'connection' | 'upsert';
    replay?: boolean;
  } = {},
) => {
  const upserted: StickyComment[] = [];
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
      idOf: async () => null,
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
          checking: null,
          ended: false,
          completed: false,
          decisions: false,
          isReplay: over.replay ?? false,
          isSearch: false,
        };
      },
      wasWorkedBy: async () => true,
      teamOfRun: async () => null,
      reasoning: async () => null,
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
      upsert: async (comment) => {
        if (over.failing === 'upsert') {
          await unreachable();
        }
        upserted.push(comment);
      },
      withdraw: async () => undefined,
    },
    { now: () => NOW, sleep: async () => undefined },
    {
      changeStackOf: ({ runId }) => `https://app.example/runs/${runId}/changes`,
      decisionsOf: ({ taskId }) =>
        `https://app.example/tasks/${taskId}#decisions`,
    },
  );

  return { announcer, upserted };
};

describe('AnnounceChangeStack', () => {
  it('keeps one comment on the task’s pull request that links its newest stack', async () => {
    const { announcer, upserted } = announcing();

    await announcer.ofRun(RunId.of('run-1'));

    expect(upserted).toHaveLength(1);
    expect(upserted[0]?.repository.name).toBe('widgets');
    expect(upserted[0]?.body).toContain(
      'https://app.example/runs/run-1/changes',
    );
  });

  it('never comments for a replay, whatever its run says of a task', async () => {
    const { announcer, upserted } = announcing({ replay: true });

    await announcer.ofRun(RunId.of('run-1'));

    expect(upserted).toEqual([]);
  });

  it('says nothing while the task has no pull request', async () => {
    const { announcer, upserted } = announcing({ pullRequest: null });

    await announcer.ofTask(TaskId.of('task-1'));

    expect(upserted).toEqual([]);
  });

  it('lets a failure to call Work or GitHub surface, so the delivery is tried again', async () => {
    for (const failing of ['run', 'task', 'connection', 'upsert'] as const) {
      const { announcer } = announcing({ failing });

      await expect(announcer.ofRun(RunId.of('run-1'))).rejects.toThrow(
        'unreachable',
      );
    }
  });
});
