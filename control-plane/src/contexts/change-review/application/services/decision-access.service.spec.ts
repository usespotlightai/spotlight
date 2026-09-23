import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewedTask,
  WorkPort,
} from '@change-review/application/ports/work.port';
import { DecisionAccess } from '@change-review/application/services/decision-access.service';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const access = (
  over: { member?: boolean; task?: Partial<ReviewedTask> | null } = {},
) =>
  new DecisionAccess(
    {
      memberOf: async () =>
        over.member === false
          ? null
          : { workspaceId: WORKSPACE, by: UserId.of('user_1') },
    } as unknown as PeoplePort,
    {
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
  ).ofTask('team_1', 'task_1', 'user_1');

describe('who may see and dispute a task’s decisions', () => {
  it('is a member of the team the task is on', async () => {
    expect((await access())?.by.value).toBe('user_1');
  });

  it('is nobody outside the team', async () => {
    expect(await access({ member: false })).toBeNull();
  });

  it('is nobody when the task is in another team or workspace', async () => {
    expect(await access({ task: { teamId: TeamId.of('team_2') } })).toBeNull();
    expect(
      await access({ task: { workspaceId: WorkspaceId.of('ws_2') } }),
    ).toBeNull();
    expect(await access({ task: null })).toBeNull();
  });
});
