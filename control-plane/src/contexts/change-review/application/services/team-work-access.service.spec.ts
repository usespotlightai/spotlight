import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
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
    task?: Partial<ReviewedTask> | null;
    run?: Partial<RunForReview> | null;
    ranFor?: TeamId | null;
  } = {},
) =>
  new TeamWorkAccess(
    {
      viewerOf: async () =>
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
      run: async (): Promise<RunForReview | null> =>
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
              isReplay: false,
              isSearch: false,
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
      teamOfRun: async () =>
        over.ranFor === undefined ? TeamId.of('team_1') : over.ranFor,
    } as unknown as WorkPort,
  );

const reviewing = (over: Parameters<typeof access>[0] = {}) =>
  access(over).reviewing('team_1', 'run_1', 'user_1');

const deciding = (over: Parameters<typeof access>[0] = {}) =>
  access(over).task('team_1', 'task_1', 'user_1');

describe('who may see a task’s change stacks', () => {
  it('is a member of the team the task is on', async () => {
    expect(
      (await access().task('team_1', 'task_1', 'user_1'))?.task.id.value,
    ).toBe('task_1');
  });

  it('is nobody outside the team, or for a task of another team or workspace', async () => {
    expect(
      await access({ member: false }).task('team_1', 'task_1', 'user_1'),
    ).toBeNull();
    expect(
      await access({ task: { teamId: TeamId.of('team_2') } }).task(
        'team_1',
        'task_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ task: { workspaceId: WorkspaceId.of('ws_2') } }).task(
        'team_1',
        'task_1',
        'user_1',
      ),
    ).toBeNull();
  });
});

describe('who may see a run’s change stacks', () => {
  it('is a member of the team the run’s task is on', async () => {
    expect((await access().run('team_1', 'run_1', 'user_1'))?.id.value).toBe(
      'run_1',
    );
  });

  it('is nobody for a run of another team’s task, a run with no task, or no run', async () => {
    expect(
      await access({ task: { teamId: TeamId.of('team_2') } }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: { taskId: null } }).run('team_1', 'run_1', 'user_1'),
    ).toBeNull();
    expect(
      await access({ run: null }).run('team_1', 'run_1', 'user_1'),
    ).toBeNull();
    expect(
      await access({ member: false }).run('team_1', 'run_1', 'user_1'),
    ).toBeNull();
  });
});

describe('who may see a replay’s or a search’s change stacks', () => {
  const replay = { taskId: null, isReplay: true };

  it('is a member of the team the replay ran for', async () => {
    expect(
      (await access({ run: replay }).run('team_1', 'run_1', 'user_1'))?.id
        .value,
    ).toBe('run_1');
    expect(
      (
        await access({ run: { taskId: null, isSearch: true } }).run(
          'team_1',
          'run_1',
          'user_1',
        )
      )?.id.value,
    ).toBe('run_1');
  });

  it('is nobody outside that team, nor for a replay whose team is gone or in another workspace', async () => {
    expect(
      await access({ run: replay, member: false }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: replay, ranFor: TeamId.of('team_2') }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: replay, ranFor: null }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({
        run: { ...replay, workspaceId: WorkspaceId.of('ws_2') },
      }).run('team_1', 'run_1', 'user_1'),
    ).toBeNull();
  });
});

describe('who may review a run', () => {
  it('is a member of the team the run’s task is on', async () => {
    const found = await reviewing();

    expect(found.by.value).toBe('user_1');
    expect(found.task.id.value).toBe('task_1');
  });

  it('is nobody outside the team', async () => {
    await expect(reviewing({ member: false })).rejects.toThrow(
      UnknownReviewError,
    );
  });

  it('is nobody when the run’s task is on another team of the same workspace', async () => {
    await expect(
      reviewing({ task: { teamId: TeamId.of('team_2') } }),
    ).rejects.toThrow(UnknownReviewError);
  });

  it('is nobody when the run’s task is in another workspace', async () => {
    await expect(
      reviewing({ task: { workspaceId: WorkspaceId.of('ws_2') } }),
    ).rejects.toThrow(UnknownReviewError);
  });

  it('is nobody when there is no run, or it works on no task', async () => {
    await expect(reviewing({ run: null })).rejects.toThrow(UnknownReviewError);
    await expect(reviewing({ run: { taskId: null } })).rejects.toThrow(
      UnknownReviewError,
    );
    await expect(reviewing({ task: null })).rejects.toThrow(UnknownReviewError);
  });
});

describe('who may see and dispute a task’s decisions', () => {
  it('is a member of the team the task is on', async () => {
    expect((await deciding())?.by.value).toBe('user_1');
  });

  it('is nobody outside the team', async () => {
    expect(await deciding({ member: false })).toBeNull();
  });

  it('is nobody when the task is in another team or workspace', async () => {
    expect(
      await deciding({ task: { teamId: TeamId.of('team_2') } }),
    ).toBeNull();
    expect(await deciding({ task: { teamId: null } })).toBeNull();
    expect(
      await deciding({ task: { workspaceId: WorkspaceId.of('ws_2') } }),
    ).toBeNull();
    expect(await deciding({ task: null })).toBeNull();
  });
});
