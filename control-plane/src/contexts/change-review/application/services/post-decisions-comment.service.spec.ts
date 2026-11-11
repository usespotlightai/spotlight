import type {
  DecisionDto,
  TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { PostDecisionsComment } from '@change-review/application/services/post-decisions-comment.service';
import { MarkdownCommentBodies } from '@change-review/infrastructure/rendering/markdown-comment-bodies';
import type {
  StickyComment,
  StickyCommentPlace,
} from '@github/application/ports/pull-request-comments.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');

const LIMITED: DecisionDto = {
  id: 'decision_1',
  kind: 'limitation',
  title: 'Retries only once',
  why: 'Backoff is not in the client yet.',
  alternatives: [],
  paths: ['api/src/uploads.ts'],
  journalSteps: [7],
  disputes: [],
};

const generated = (decisions: readonly DecisionDto[]): TaskDecisionsDto => ({
  runId: 'run_1',
  generating: false,
  status: 'proposed',
  merges: [],
  decisions,
});

const posting = (
  stored: TaskDecisionsDto | null,
  task: Partial<ReviewedTask> = {},
) => {
  const upserted: StickyComment[] = [];
  const deleted: StickyCommentPlace[] = [];

  const service = new PostDecisionsComment(
    { ofTask: async () => stored } as unknown as DecisionReaderPort,
    {
      task: async (): Promise<ReviewedTask> => ({
        id: TASK,
        workspaceId: WORKSPACE,
        teamId: TeamId.of('team_1'),
        pullRequests: [PullRequestUrl.of('https://github.com/acme/api/pull/7')],
        openPullRequests: [],
        reviewedPullRequest: null,
        reviewing: false,
        currentRunId: null,
        ...task,
      }),
    } as unknown as WorkPort,
    {
      slugOf: async () => 'acme',
      idOf: async () => null,
      mayView: async () => true,
    },
    { isConnected: async () => true },
    {
      upsert: async (comment) => {
        upserted.push(comment);
      },
      delete: async (place) => {
        deleted.push(place);
      },
    },
    {
      changeStackOf: () => '',
      decisionsOf: ({ taskId }) =>
        `https://app.example/tasks/${taskId.value}#decisions`,
    },
    {
      find: async () => ({ name: 'Maya Chen', image: null }),
      viewerOf: async () => null,
      actsOnTeam: async () => false,
    },
    new MarkdownCommentBodies(),
  );

  return { service, upserted, deleted };
};

describe('posting a task’s decisions on its pull request', () => {
  it('keeps one comment listing them, linked to Spotlight', async () => {
    const { service, upserted } = posting(generated([LIMITED]));

    await service.ofTask(TASK);

    expect(upserted).toHaveLength(1);
    expect(upserted[0]?.marker).toBe('<!-- spotlight:decisions -->');
    expect(upserted[0]?.repository.value).toBe('acme/api');
    expect(upserted[0]?.body).toContain('**Limitation** · Retries only once');
    expect(upserted[0]?.body).toContain(
      'https://app.example/tasks/task_1#decisions',
    );
  });

  it('keeps one comment on each pull request listing the decisions in its repository, and posts a decision in no repository of a pull request nowhere', async () => {
    const documented: DecisionDto = {
      ...LIMITED,
      id: 'decision_2',
      title: 'Documents the retry',
      paths: ['docs/uploads.md'],
    };
    const nowhere: DecisionDto = {
      ...LIMITED,
      id: 'decision_3',
      title: 'Keeps the old flag',
      paths: ['infra/flags.tf'],
    };
    const { service, upserted, deleted } = posting(
      generated([LIMITED, documented, nowhere]),
      {
        pullRequests: [
          PullRequestUrl.of('https://github.com/acme/api/pull/7'),
          PullRequestUrl.of('https://github.com/acme/Docs/pull/2'),
          PullRequestUrl.of('https://github.com/acme/web/pull/9'),
        ],
      },
    );

    await service.ofTask(TASK);

    expect(upserted.map((each) => each.pullRequest.value)).toEqual([
      'https://github.com/acme/api/pull/7',
      'https://github.com/acme/Docs/pull/2',
    ]);
    expect(upserted[0]?.body).toContain('Retries only once');
    expect(upserted.map((each) => each.body).join()).not.toContain(
      'Keeps the old flag',
    );
    expect(upserted[0]?.body).not.toContain('Documents the retry');
    expect(upserted[1]?.body).toContain('Documents the retry');
    expect(upserted[1]?.body).toContain('`uploads.md`');
    expect(upserted[1]?.body).not.toContain('Retries only once');
    expect(deleted.map((each) => each.pullRequest.value)).toEqual([
      'https://github.com/acme/web/pull/9',
    ]);
  });

  it('rewrites the comment on every pull request, so a decision moves to the pull request of its repository once it opens', async () => {
    const docs = PullRequestUrl.of('https://github.com/acme/docs/pull/2');
    const { service, upserted } = posting(
      generated([LIMITED, { ...LIMITED, id: 'd2', paths: ['docs/a.md'] }]),
      {
        pullRequests: [
          PullRequestUrl.of('https://github.com/acme/api/pull/7'),
          docs,
        ],
      },
    );

    await service.ofTask(TASK);

    expect(upserted.map((each) => each.pullRequest.value)).toEqual([
      'https://github.com/acme/api/pull/7',
      docs.value,
    ]);
  });

  it('deletes the comment when the latest run has no decisions', async () => {
    const { service, upserted, deleted } = posting(generated([]));

    await service.ofTask(TASK);

    expect(upserted).toEqual([]);
    expect(deleted).toHaveLength(1);
  });

  it('says nothing before decisions are generated for a run', async () => {
    const { service, upserted, deleted } = posting(null);

    await service.ofTask(TASK);

    expect([...upserted, ...deleted]).toEqual([]);
  });

  it.each([
    ['has no pull request yet', { pullRequests: [] }],
    ['only reviews a pull request opened elsewhere', { reviewing: true }],
  ])('says nothing on a task that %s', async (_, task) => {
    const { service, upserted } = posting(generated([LIMITED]), task);

    await service.ofTask(TASK);

    expect(upserted).toEqual([]);
  });
});
