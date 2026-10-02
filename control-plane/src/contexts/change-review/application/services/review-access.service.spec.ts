import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedRun,
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { ReviewAccess } from '@change-review/application/services/review-access.service';
import { UnknownReviewError } from '@change-review/domain/exceptions/unknown-review.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const access = (
  over: {
    member?: boolean;
    run?: Partial<ReviewedRun> | null;
    task?: Partial<ReviewedTask> | null;
  } = {},
) =>
  new ReviewAccess(
    {
      memberOf: async () =>
        over.member === false
          ? null
          : {
              workspaceId: WORKSPACE,
              teamId: TeamId.of('team_1'),
              by: UserId.of('user_1'),
            },
      find: async () => ({ name: 'Ada', image: null }),
    } as unknown as PeoplePort,
    {
      run: async (): Promise<ReviewedRun | null> =>
        over.run === null
          ? null
          : {
              id: RunId.of('run_1'),
              workspaceId: WORKSPACE,
              taskId: TaskId.of('task_1'),
              checking: null,
              ended: true,
              completed: true,
              decisions: false,
              replay: false,
              ...over.run,
            },
      task: async (): Promise<ReviewedTask | null> =>
        over.task === null
          ? null
          : {
              id: TaskId.of('task_1'),
              workspaceId: WORKSPACE,
              teamId: TeamId.of('team_1'),
              pullRequest: null,
              reviewing: false,
              currentRunId: null,
              ...over.task,
            },
    } as unknown as WorkPort,
  ).ofRun('team_1', 'run_1', 'user_1');

describe('who may review a run', () => {
  it('is a member of the team the run’s task is on', async () => {
    const reviewing = await access();

    expect(reviewing.by.value).toBe('user_1');
    expect(reviewing.task.id.value).toBe('task_1');
  });

  it('is nobody outside the team', async () => {
    await expect(access({ member: false })).rejects.toThrow(UnknownReviewError);
  });

  it('is nobody when the run’s task is on another team of the same workspace', async () => {
    await expect(
      access({ task: { teamId: TeamId.of('team_2') } }),
    ).rejects.toThrow(UnknownReviewError);
  });

  it('is nobody when the run’s task is in another workspace', async () => {
    await expect(
      access({ task: { workspaceId: WorkspaceId.of('ws_2') } }),
    ).rejects.toThrow(UnknownReviewError);
  });

  it('is nobody when there is no run, or it works on no task', async () => {
    await expect(access({ run: null })).rejects.toThrow(UnknownReviewError);
    await expect(access({ run: { taskId: null } })).rejects.toThrow(
      UnknownReviewError,
    );
    await expect(access({ task: null })).rejects.toThrow(UnknownReviewError);
  });
});
