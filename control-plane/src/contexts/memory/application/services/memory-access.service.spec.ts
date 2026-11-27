import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  RememberedTask,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoryAccess } from '@memory/application/services/memory-access.service';
import { TeamNotFoundError } from '@memory/domain/exceptions/team-not-found.error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
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
    partial<PeoplePort>({
      viewerOf: () =>
        Promise.resolve(
          (input.member ?? true)
            ? { workspaceId: WorkspaceId.of('ws_1'), by: UserId.of('user_ada') }
            : null,
        ),
    }),
    partial<WorkPort>({
      task: () =>
        Promise.resolve(
          input.task === null ? null : { ...TASK, ...input.task },
        ),
    }),
  ).ofTask(TeamId.of('team_1'), TaskId.of('task_1'), UserId.of('user_ada'));

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
