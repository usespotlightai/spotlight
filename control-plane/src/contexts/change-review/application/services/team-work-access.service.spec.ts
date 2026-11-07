import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  RunForReview,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { TeamMembershipRequiredError } from '@change-review/domain/exceptions/team-membership-required.error';
import { UnknownDecisionError } from '@change-review/domain/exceptions/unknown-decision.error';
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
    readsTeam?: boolean;
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
      readsTeam: async () => over.readsTeam ?? over.member !== false,
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
              trial: false,
              isolated: false,
              checkouts: 1,
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

describe('who may see a trial’s or a search’s change stacks', () => {
  const trial = { taskId: null, trial: true, isolated: true };

  it('is a member of the team the trial ran for', async () => {
    expect(
      (await access({ run: trial }).run('team_1', 'run_1', 'user_1'))?.id.value,
    ).toBe('run_1');
    expect(
      (
        await access({
          run: { taskId: null, isolated: true, checkouts: 0 },
        }).run('team_1', 'run_1', 'user_1')
      )?.id.value,
    ).toBe('run_1');
  });

  it('is nobody outside that team, nor for a trial whose team is gone or in another workspace', async () => {
    expect(
      await access({ run: trial, member: false }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: trial, ranFor: TeamId.of('team_2') }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({ run: trial, ranFor: null }).run(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).toBeNull();
    expect(
      await access({
        run: { ...trial, workspaceId: WorkspaceId.of('ws_2') },
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

describe('who may see a task’s decisions', () => {
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

describe('who may act in the reviews of a team’s work', () => {
  const unseen = () => new UnknownDecisionError();
  const outsider = { readsTeam: false };

  it('is someone the team rule admits: a team member or a workspace admin', async () => {
    expect(
      (await access().actingOnTask('team_1', 'task_1', 'user_1', unseen)).task
        .id.value,
    ).toBe('task_1');
    expect(
      (await access().actingOnRun('team_1', 'run_1', 'user_1', unseen)).id
        .value,
    ).toBe('run_1');
    expect(
      (await access().actingInReview('team_1', 'run_1', 'user_1')).author.kind,
    ).toBe('person');
  });

  it('is not a workspace member outside the team, who still sees the work', async () => {
    expect(
      await access(outsider).task('team_1', 'task_1', 'user_1'),
    ).not.toBeNull();
    await expect(
      access(outsider).actingOnTask('team_1', 'task_1', 'user_1', unseen),
    ).rejects.toThrow(TeamMembershipRequiredError);
    await expect(
      access(outsider).actingOnRun('team_1', 'run_1', 'user_1', unseen),
    ).rejects.toThrow(TeamMembershipRequiredError);
    await expect(
      access(outsider).actingInReview('team_1', 'run_1', 'user_1'),
    ).rejects.toThrow(TeamMembershipRequiredError);
  });

  it('finds nothing for someone who does not see the work, or work of another team', async () => {
    await expect(
      access({ member: false }).actingOnTask(
        'team_1',
        'task_1',
        'user_1',
        unseen,
      ),
    ).rejects.toThrow(UnknownDecisionError);
    await expect(
      access({ task: { teamId: TeamId.of('team_2') } }).actingOnRun(
        'team_1',
        'run_1',
        'user_1',
        unseen,
      ),
    ).rejects.toThrow(UnknownDecisionError);
    await expect(
      access({ run: { taskId: null } }).actingInReview(
        'team_1',
        'run_1',
        'user_1',
      ),
    ).rejects.toThrow(UnknownReviewError);
  });
});
