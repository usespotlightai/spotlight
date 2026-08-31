import type {
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import { CarryGitCall } from '@application/services/carry-git-call.service';
import { RunAtHand } from '@application/services/run-at-hand.service';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { InvalidRunTransitionError } from '@domain/exceptions/invalid-run-transition.error';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-30T09:00:00.000Z');

const call: GitCall = {
  method: 'GET',
  path: '/info/refs',
  search: '?service=git-upload-pack',
  headers: {},
  body: null,
};

const task = (repository: string | null) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
    repository: repository ? Repository.of(repository) : null,
  });

const claimedBy = (runner: string) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    taskId: TaskId.of('task_1'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 4_000 },
      continuity: { key: 'task:station', keep: true },
    }),
  }).claim(RunnerId.of(runner), NOW);

const carrying = (run: Run | null, held: Task | null) => {
  const git = {
    call: vi.fn(async () => ({ status: 200, headers: {}, body: null })),
  };

  const service = new CarryGitCall(
    new RunAtHand(
      { findById: vi.fn(async () => run) } as unknown as RunRepository,
      { find: vi.fn(async () => held) } as unknown as TaskRepository,
    ),
    git as unknown as RepositoryGitPort,
  );

  return { service, git };
};

describe('CarryGitCall', () => {
  it('carries the call to the repository the task names', async () => {
    const { service, git } = carrying(
      claimedBy('runner_1'),
      task('acme/widgets'),
    );

    await service.carry('run_1', 'runner_1', call);

    expect(git.call).toHaveBeenCalledWith(Repository.of('acme/widgets'), call);
  });

  // The whole point of proxying: a runner reaches what it is working on, and
  // nothing else anyone else is working on.
  it('refuses a runner that does not hold the run', async () => {
    const { service, git } = carrying(
      claimedBy('runner_1'),
      task('acme/widgets'),
    );

    await expect(service.carry('run_1', 'runner_2', call)).rejects.toThrow(
      InvalidRunTransitionError,
    );
    expect(git.call).not.toHaveBeenCalled();
  });

  it('refuses a run nobody is holding', async () => {
    const queued = Run.enqueue({
      id: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      taskId: TaskId.of('task_1'),
      spec: RunSpec.of({
        command: { executable: 'sh', args: [] },
        briefing: 'do the thing',
        handover: { options: [], noteLimit: 4_000 },
        continuity: { key: 'task:station', keep: true },
      }),
    });
    const { service, git } = carrying(queued, task('acme/widgets'));

    await expect(service.carry('run_1', 'runner_1', call)).rejects.toThrow(
      InvalidRunTransitionError,
    );
    expect(git.call).not.toHaveBeenCalled();
  });

  it('says nothing to carry where the task names no repository', async () => {
    const { service, git } = carrying(claimedBy('runner_1'), task(null));

    await expect(service.carry('run_1', 'runner_1', call)).resolves.toBeNull();
    expect(git.call).not.toHaveBeenCalled();
  });

  it('refuses a run that does not exist', async () => {
    const { service } = carrying(null, null);

    await expect(service.carry('run_1', 'runner_1', call)).rejects.toThrow(
      UnknownRunError,
    );
  });
});
