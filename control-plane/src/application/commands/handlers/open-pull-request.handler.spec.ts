import { OpenPullRequestHandler } from '@application/commands/handlers/open-pull-request.handler';
import { OpenPullRequestCommand } from '@application/commands/open-pull-request.command';
import type { PullRequestPort } from '@application/ports/pull-request.port';
import { AnnounceTaskEvents } from '@application/services/announce-task-events';
import { RunAtHand } from '@application/services/run-at-hand.service';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Run } from '@domain/aggregates/run.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
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

const task = () =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

/** Enough of a line for the handler: the rule for which repository to open. */
const lineWorking = (repositories: readonly string[]): AssemblyLine => {
  const held = LineRepositories.of(
    repositories.map((each) => Repository.of(each)),
  );

  return {
    opening: (name: string | null) => held.opening(name),
  } as unknown as AssemblyLine;
};

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

const opening = (
  held: Task,
  repositories: readonly string[] = ['acme/widgets'],
) => {
  const saved: Task[] = [];
  const notifier = { notify: vi.fn(async () => []) };
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

  const lines = {
    holding: vi.fn(async () => lineWorking(repositories)),
  } as unknown as AssemblyLineRepository;

  const handler = new OpenPullRequestHandler(
    new RunAtHand(
      { findById: vi.fn(async () => claimed()) } as unknown as RunRepository,
      tasks,
    ),
    tasks,
    lines,
    {
      connectionTo: vi.fn(async () => Connection.of('github', '42')),
    } as unknown as WorkspaceConnections,
    pullRequests as unknown as PullRequestPort,
    new AnnounceTaskEvents(notifier, tasks),
  );

  return { handler, pullRequests, saved, notifier };
};

describe('OpenPullRequestHandler', () => {
  it('opens one against the line’s only repository, for the task’s branch', async () => {
    const { handler, pullRequests } = opening(task());

    const opened = await handler.execute(
      new OpenPullRequestCommand(
        'run_1',
        'runner_1',
        'Fix the queue',
        'why',
        null,
      ),
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

  it('opens against the repository the agent names where the line works several', async () => {
    const { handler, pullRequests } = opening(task(), ['acme/api', 'acme/web']);

    await handler.execute(
      new OpenPullRequestCommand(
        'run_1',
        'runner_1',
        'Fix the queue',
        '',
        'web',
      ),
    );

    expect(pullRequests.open).toHaveBeenCalledWith(
      expect.objectContaining({ repository: Repository.of('acme/web') }),
    );
  });

  it('refuses where several are worked and the agent named none', async () => {
    const { handler, pullRequests } = opening(task(), ['acme/api', 'acme/web']);

    await expect(
      handler.execute(
        new OpenPullRequestCommand(
          'run_1',
          'runner_1',
          'Fix the queue',
          '',
          null,
        ),
      ),
    ).rejects.toThrow(/name which one/);
    expect(pullRequests.open).not.toHaveBeenCalled();
  });

  it('refuses a repository the line does not work', async () => {
    const { handler, pullRequests } = opening(task(), ['acme/api']);

    await expect(
      handler.execute(
        new OpenPullRequestCommand(
          'run_1',
          'runner_1',
          'Fix the queue',
          '',
          'web',
        ),
      ),
    ).rejects.toThrow(/no repository named "web"/);
    expect(pullRequests.open).not.toHaveBeenCalled();
  });

  it('remembers where it landed, so nothing has to read the note for it', async () => {
    const { handler, saved } = opening(task());

    await handler.execute(
      new OpenPullRequestCommand(
        'run_1',
        'runner_1',
        'Fix the queue',
        '',
        null,
      ),
    );

    expect(saved[0]?.pullRequest?.value).toBe(
      'https://github.com/acme/widgets/pull/7',
    );
  });

  // Told once the pull request is open, so a bound host can share it.
  it('announces the pull request it opened', async () => {
    const { handler, notifier, saved } = opening(task());

    await handler.execute(
      new OpenPullRequestCommand(
        'run_1',
        'runner_1',
        'Fix the queue',
        '',
        null,
      ),
    );

    expect(notifier.notify).toHaveBeenCalledWith(
      saved[0],
      'task.pull-request-opened',
    );
  });

  // A station worked twice must not leave two pull requests behind.
  it('answers with the one already open rather than opening another', async () => {
    const already = task().openedAt(
      PullRequestUrl.of('https://github.com/acme/widgets/pull/1'),
    );
    const { handler, pullRequests } = opening(already);

    const opened = await handler.execute(
      new OpenPullRequestCommand(
        'run_1',
        'runner_1',
        'Fix the queue',
        '',
        null,
      ),
    );

    expect(opened.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(pullRequests.open).not.toHaveBeenCalled();
  });

  it('refuses where the line works no repository', async () => {
    const { handler, pullRequests } = opening(task(), []);

    await expect(
      handler.execute(
        new OpenPullRequestCommand(
          'run_1',
          'runner_1',
          'Fix the queue',
          '',
          null,
        ),
      ),
    ).rejects.toThrow(/no repository/);
    expect(pullRequests.open).not.toHaveBeenCalled();
  });
});
