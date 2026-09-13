import type { PullRequestPort } from '@application/ports/pull-request.port';
import { AnnounceTaskEvents } from '@application/services/announce-task-events';
import { OpenPullRequest } from '@application/services/open-pull-request.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { NoGitHubInstallationError } from '@domain/exceptions/no-github-installation.error';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { Connection } from '@domain/value-objects/connection.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const task = () => {
  const added = Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });
  added.pullEvents();

  return added;
};

const lineWorking = (repositories: readonly string[]): Line => {
  const held = LineRepositories.of(
    repositories.map((each) => Repository.of(each)),
  );

  return {
    opening: (name: string | null) => held.opening(name),
  } as unknown as Line;
};

const asking = (repository: string | null = null, body = '') => ({
  title: 'Fix the queue',
  body,
  repository,
});

const opening = (
  over: { connected?: boolean; repositories?: readonly string[] } = {},
) => {
  const saved: Task[] = [];
  const announced: { task: Task; event: string }[] = [];
  const opened: Parameters<PullRequestPort['open']>[0][] = [];

  const pullRequests = {
    open: async (asked: Parameters<PullRequestPort['open']>[0]) => {
      opened.push(asked);
      return { url: 'https://github.com/acme/widgets/pull/7' };
    },
  } as unknown as PullRequestPort;
  const tasks = {
    find: async () => saved[saved.length - 1] ?? null,
    save: async (each: Task) => {
      saved.push(each);
    },
  } as unknown as TaskRepository;
  const notifier = {
    notify: async (each: Task, event: string) => {
      announced.push({ task: each, event });
      return [];
    },
  };

  const service = new OpenPullRequest(
    tasks,
    {
      connectionTo: async () =>
        over.connected === false ? null : Connection.of('github', '42'),
    } as unknown as WorkspaceConnections,
    pullRequests,
    new AnnounceTaskEvents(notifier, tasks),
  );
  const line = lineWorking(over.repositories ?? ['acme/widgets']);

  return {
    open: (held: Task, asked = asking()) => service.open(held, line, asked),
    opened,
    saved,
    announced,
  };
};

describe('OpenPullRequest', () => {
  it('opens one against the line’s only repository, for the task’s branch', async () => {
    const { open, opened } = opening();

    const answered = await open(task(), asking(null, 'why'));

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/7');
    expect(opened).toEqual([
      {
        installation: GitHubInstallation.of('42'),
        repository: Repository.of('acme/widgets'),
        branch: 'spotlight/task_1',
        title: 'Fix the queue',
        body: 'why',
      },
    ]);
  });

  it('opens against the repository the agent names where the line works several', async () => {
    const { open, opened } = opening({
      repositories: ['acme/api', 'acme/web'],
    });

    await open(task(), asking('web'));

    expect(opened[0]?.repository).toEqual(Repository.of('acme/web'));
  });

  it('refuses where several are worked and the agent named none', async () => {
    const { open, opened } = opening({
      repositories: ['acme/api', 'acme/web'],
    });

    await expect(open(task())).rejects.toThrow(/name which one/);
    expect(opened).toEqual([]);
  });

  it('refuses a repository the line does not work', async () => {
    const { open, opened } = opening({ repositories: ['acme/api'] });

    await expect(open(task(), asking('web'))).rejects.toThrow(
      /no repository named "web"/,
    );
    expect(opened).toEqual([]);
  });

  it('refuses where the line works no repository', async () => {
    const { open, opened } = opening({ repositories: [] });

    await expect(open(task())).rejects.toThrow(/no repository/);
    expect(opened).toEqual([]);
  });

  it('refuses where the workspace reaches no GitHub installation', async () => {
    const { open, opened } = opening({ connected: false });

    await expect(open(task())).rejects.toThrow(NoGitHubInstallationError);
    expect(opened).toEqual([]);
  });

  it('remembers where it landed, so nothing has to read the note for it', async () => {
    const { open, saved } = opening();

    await open(task());

    expect(saved[0]?.pullRequest?.value).toBe(
      'https://github.com/acme/widgets/pull/7',
    );
  });

  it('announces the pull request it opened', async () => {
    const { open, announced, saved } = opening();

    await open(task());

    expect(announced).toEqual([
      { task: saved[0], event: 'task.pull-request-opened' },
    ]);
  });

  it('answers with the one already open rather than opening another', async () => {
    const already = task().openedAt(
      PullRequestUrl.of('https://github.com/acme/widgets/pull/1'),
    );
    const { open, opened, saved } = opening();

    const answered = await open(already);

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(opened).toEqual([]);
    expect(saved).toEqual([]);
  });
});
