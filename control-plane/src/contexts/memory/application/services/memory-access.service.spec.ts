import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { TeamNotFoundError } from '@memory/domain/exceptions/team-not-found.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TASK: RememberedTask = {
  id: TaskId.of('task_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  fromOutside: false,
};

const access = (input: {
  member?: boolean;
  task?: Partial<RememberedTask> | null;
}) =>
  new MemoryAccess(
    {
      memberOf: async () =>
        (input.member ?? true)
          ? { workspaceId: WorkspaceId.of('ws_1'), by: UserId.of('user_ada') }
          : null,
    } as unknown as PeoplePort,
    {
      task: async () =>
        input.task === null ? null : { ...TASK, ...input.task },
    } as unknown as WorkPort,
  ).ofTask('team_1', 'task_1', 'user_ada');

describe('MemoryAccess', () => {
  it('lets anyone on the task’s team review its memories', async () => {
    expect((await access({}))?.access.by.value).toBe('user_ada');
  });

  it('keeps out anyone not on the team, saying there is no such team for them', async () => {
    await expect(access({ member: false })).rejects.toBeInstanceOf(
      TeamNotFoundError,
    );
  });

  it('keeps out a task of another team or workspace, or none at all', async () => {
    expect(await access({ task: { teamId: TeamId.of('team_2') } })).toBeNull();
    expect(
      await access({ task: { workspaceId: WorkspaceId.of('ws_2') } }),
    ).toBeNull();
    expect(await access({ task: null })).toBeNull();
  });
});
