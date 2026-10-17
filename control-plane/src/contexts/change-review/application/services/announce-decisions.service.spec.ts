import type {
  DecisionDto,
  TaskDecisionsDto,
} from '@change-review/application/dto/decision.dto';
import type { DecisionReaderPort } from '@change-review/application/ports/decision-reader.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { AnnounceDecisions } from '@change-review/application/services/announce-decisions.service';
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
  steps: [7],
  disputes: [],
};

const drafted = (decisions: readonly DecisionDto[]): TaskDecisionsDto => ({
  runId: 'run_1',
  drafting: false,
  status: 'proposed',
  merge: null,
  decisions,
});

const announcing = (
  stored: TaskDecisionsDto | null,
  task: Partial<ReviewedTask> = {},
) => {
  const upserted: StickyComment[] = [];
  const withdrawn: StickyCommentPlace[] = [];

  const service = new AnnounceDecisions(
    { ofTask: async () => stored } as unknown as DecisionReaderPort,
    {
      task: async (): Promise<ReviewedTask> => ({
        id: TASK,
        workspaceId: WORKSPACE,
        teamId: TeamId.of('team_1'),
        pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
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
      withdraw: async (place) => {
        withdrawn.push(place);
      },
    },
    {
      changeStackOf: () => '',
      decisionsOf: ({ taskId }) =>
        `https://app.example/tasks/${taskId}#decisions`,
    },
    {
      find: async () => ({ name: 'Maya Chen', image: null }),
      pictureOf: () => null,
      memberOf: async () => null,
    },
  );

  return { service, upserted, withdrawn };
};

describe('announcing a task’s decisions on its pull request', () => {
  it('keeps one comment listing them, linked to Spotlight', async () => {
    const { service, upserted } = announcing(drafted([LIMITED]));

    await service.ofTask(TASK);

    expect(upserted).toHaveLength(1);
    expect(upserted[0]?.marker).toBe('<!-- spotlight:decisions -->');
    expect(upserted[0]?.repository.value).toBe('acme/api');
    expect(upserted[0]?.body).toContain('**Limitation** · Retries only once');
    expect(upserted[0]?.body).toContain(
      'https://app.example/tasks/task_1#decisions',
    );
  });

  it('withdraws the comment once the latest run decided nothing', async () => {
    const { service, upserted, withdrawn } = announcing(drafted([]));

    await service.ofTask(TASK);

    expect(upserted).toEqual([]);
    expect(withdrawn).toHaveLength(1);
  });

  it('says nothing before any run was drafted', async () => {
    const { service, upserted, withdrawn } = announcing(null);

    await service.ofTask(TASK);

    expect([...upserted, ...withdrawn]).toEqual([]);
  });

  it.each([
    ['has no pull request yet', { pullRequest: null }],
    ['only reviews a pull request opened elsewhere', { reviewing: true }],
  ])('says nothing on a task that %s', async (_, task) => {
    const { service, upserted } = announcing(drafted([LIMITED]), task);

    await service.ofTask(TASK);

    expect(upserted).toEqual([]);
  });
});
