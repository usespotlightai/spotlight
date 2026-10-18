import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { ChangeStackAccess } from '@change-review/application/services/change-stack-access.service';
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
  new ChangeStackAccess(
    {
      memberOf: async () =>
        over.member === false
          ? null
          : {
              workspaceId: WORKSPACE,
              teamId: TeamId.of('team_1'),
              by: UserId.of('user_1'),
            },
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

describe('who may see a task’s change stacks', () => {
  it('is a member of the team the task is on', async () => {
    expect(
      (await access().ofTask('team_1', 'task_1', 'user_1'))?.id.value,
    ).toBe('task_1');
  });

  it('is nobody outside the team, or for a task of another team or workspace', async () => {
    expect(
      await access({ member: false }).ofTask('team_1', 'task_1', 'user_1'),
    ).toBeNull();
    expect(
      await access({ task: { teamId: TeamId.of('team_2') } }).ofTask(
        'team_1',
        'task_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ task: { workspaceId: WorkspaceId.of('ws_2') } }).ofTask(
        'team_1',
        'task_1',
        'user_1',
      ),
    ).toBeNull();
  });
});

describe('who may see a run’s change stacks', () => {
  it('is a member of the team the run’s task is on', async () => {
    expect((await access().ofRun('team_1', 'run_1', 'user_1'))?.id.value).toBe(
      'run_1',
    );
  });

  it('is nobody for a run of another team’s task, a run with no task, or no run', async () => {
    expect(
      await access({ task: { teamId: TeamId.of('team_2') } }).ofRun(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: { taskId: null } }).ofRun(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: null }).ofRun('team_1', 'run_1', 'user_1'),
    ).toBeNull();
    expect(
      await access({ member: false }).ofRun('team_1', 'run_1', 'user_1'),
    ).toBeNull();
  });
});

describe('who may see a replay’s or a search’s change stacks', () => {
  const replay = { taskId: null, isReplay: true };

  it('is a member of the team the replay ran for', async () => {
    expect(
      (await access({ run: replay }).ofRun('team_1', 'run_1', 'user_1'))?.id
        .value,
    ).toBe('run_1');
    expect(
      (
        await access({ run: { taskId: null, isSearch: true } }).ofRun(
          'team_1',
          'run_1',
          'user_1',
        )
      )?.id.value,
    ).toBe('run_1');
  });

  it('is nobody outside that team, nor for a replay whose team is gone or in another workspace', async () => {
    expect(
      await access({ run: replay, member: false }).ofRun(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: replay, ranFor: TeamId.of('team_2') }).ofRun(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: replay, ranFor: null }).ofRun(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({
        run: { ...replay, workspaceId: WorkspaceId.of('ws_2') },
      }).ofRun('team_1', 'run_1', 'user_1'),
    ).toBeNull();
  });
});
