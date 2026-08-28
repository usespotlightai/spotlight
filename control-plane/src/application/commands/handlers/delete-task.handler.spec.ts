import { DeleteTaskCommand } from '@application/commands/delete-task.command';
import { DeleteTaskHandler } from '@application/commands/handlers/delete-task.handler';
import { UseCaseFault } from '@application/errors/use-case.fault';
import { Task } from '@domain/aggregates/task.aggregate';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const standing = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-08-28T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const tasks = (found: Task | null = standing()) =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    standingAt: vi.fn(async () => []),
  }) satisfies TaskRepository;

describe('DeleteTaskHandler', () => {
  it('takes the task away', async () => {
    const held = tasks();

    await new DeleteTaskHandler(held).execute(new DeleteTaskCommand('task_1'));

    expect(held.remove).toHaveBeenCalledWith(TaskId.of('task_1'));
  });

  it('refuses a task that is not there', async () => {
    await expect(
      new DeleteTaskHandler(tasks(null)).execute(
        new DeleteTaskCommand('task_missing'),
      ),
    ).rejects.toThrow(UseCaseFault);
  });

  it('leaves nothing behind when there was nothing to take', async () => {
    const held = tasks(null);

    await new DeleteTaskHandler(held)
      .execute(new DeleteTaskCommand('task_missing'))
      .catch(() => undefined);

    expect(held.remove).not.toHaveBeenCalled();
  });
});
