import { OpenPullRequestHandler } from '@application/commands/handlers/open-pull-request.handler';
import { OpenPullRequestCommand } from '@application/commands/open-pull-request.command';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import { RunAtHand } from '@application/services/run-at-hand.service';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { GitHubInstallations } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
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

const NOW = new Date('2026-08-31T09:00:00.000Z');

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

const claimed = () =>
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
  }).claim(RunnerId.of('runner_1'), NOW);

const opening = (held: Task) => {
  const saved: Task[] = [];
  const pullRequests = {
    open: vi.fn(async () => ({
      url: 'https://github.com/acme/widgets/pull/7',
    })),
  };
  const tasks = {
    find: vi.fn(async () => held),
    save: vi.fn(async (task: Task) => {
      saved.push(task);
    }),
  } as unknown as TaskRepository;

  const handler = new OpenPullRequestHandler(
    new RunAtHand(
      { findById: vi.fn(async () => claimed()) } as unknown as RunRepository,
      tasks,
    ),
    tasks,
    {
      installationOf: vi.fn(async () => GitHubInstallation.of('42')),
    } as unknown as GitHubInstallations,
    pullRequests as unknown as PullRequestPort,
  );

  return { handler, pullRequests, saved };
};

describe('OpenPullRequestHandler', () => {
  it('opens one for the task’s own branch', async () => {
    const { handler, pullRequests } = opening(task('acme/widgets'));

    const opened = await handler.execute(
      new OpenPullRequestCommand('run_1', 'runner_1', 'Fix the queue', 'why'),
    );

    expect(opened.url).toBe('https://github.com/acme/widgets/pull/7');
    expect(pullRequests.open).toHaveBeenCalledWith({
      installation: GitHubInstallation.of('42'),
      repository: Repository.of('acme/widgets'),
      branch: 'spotlight/task_1',
      title: 'Fix the queue',
      body: 'why',
    });
  });

  it('remembers where it landed, so nothing has to read the note for it', async () => {
    const { handler, saved } = opening(task('acme/widgets'));

    await handler.execute(
      new OpenPullRequestCommand('run_1', 'runner_1', 'Fix the queue', ''),
    );

    expect(saved[0]?.pullRequest?.value).toBe(
      'https://github.com/acme/widgets/pull/7',
    );
  });

  // A station worked twice must not leave two pull requests behind.
  it('answers with the one already open rather than opening another', async () => {
    const already = task('acme/widgets').openedAt(
      PullRequestUrl.of('https://github.com/acme/widgets/pull/1'),
    );
    const { handler, pullRequests } = opening(already);

    const opened = await handler.execute(
      new OpenPullRequestCommand('run_1', 'runner_1', 'Fix the queue', ''),
    );

    expect(opened.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(pullRequests.open).not.toHaveBeenCalled();
  });

  it('refuses a task that names no repository', async () => {
    const { handler, pullRequests } = opening(task(null));

    await expect(
      handler.execute(
        new OpenPullRequestCommand('run_1', 'runner_1', 'Fix the queue', ''),
      ),
    ).rejects.toThrow(/names no repository/);
    expect(pullRequests.open).not.toHaveBeenCalled();
  });
});
