import { NoGitHubInstallationError } from '@github/application/errors/no-github-installation.error';
import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { OpenPullRequest } from '@work/application/services/open-pull-request.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const RUN = RunId.of('run_1');

const delivery = (workspaceId = 'ws_1', standsAt = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('inbox'),
        name: StationName.of('Inbox'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of(standsAt),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'work',
        harness: HarnessId.of('dev'),
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const task = () => {
  const added = Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RUN, delivery());
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
  over: {
    connected?: boolean;
    repositories?: readonly string[];
    wearer?: Task;
    meanwhile?: (task: Task) => Task;
  } = {},
) => {
  const saved: Task[] = [];
  let held: Task | null = null;
  const opened: Parameters<PullRequestPort['open']>[0][] = [];

  const pullRequests = {
    open: async (asked: Parameters<PullRequestPort['open']>[0]) => {
      if (over.connected === false) {
        throw new NoGitHubInstallationError();
      }
      opened.push(asked);
      if (held && over.meanwhile) {
        held = over.meanwhile(held);
      }
      return { url: 'https://github.com/acme/widgets/pull/7' };
    },
  } as unknown as PullRequestPort;
  const tasks = {
    find: async () => held,
    holding: async () => over.wearer ?? null,
    save: async (each: Task) => {
      saved.push(each);
    },
  } as unknown as TaskRepository;
  const line = lineWorking(over.repositories ?? ['acme/widgets']);
  const service = new OpenPullRequest(
    tasks,
    { holding: async () => line } as unknown as LineRepository,
    pullRequests,
    { run: (work) => work() } satisfies TransactionPort,
  );

  return {
    open: (task: Task, asked = asking(), runId = RUN) => {
      held = task;
      return service.open(
        { runId, taskId: task.id, stationId: task.stationId },
        asked,
      );
    },
    opened,
    saved,
  };
};

describe('OpenPullRequest', () => {
  it('opens one against the line’s only repository, for the task’s branch', async () => {
    const { open, opened } = opening();

    const answered = await open(task(), asking(null, 'why'));

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/7');
    expect(opened).toEqual([
      {
        workspaceId: WorkspaceId.of('ws_1'),
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

  it('records that it opened the pull request', async () => {
    const { open, saved } = opening();

    await open(task());

    expect(saved[0]?.pullEvents().map((each) => each.kind)).toContain(
      'task.pull-request-opened',
    );
  });

  it('takes the pull request from a task that wore it before', async () => {
    const before = Task.add({
      line: delivery(),
      at: StationId.of('station_1'),
      title: TaskTitle.of('An older attempt'),
      rank: TaskRank.between(null, null),
      now: NOW,
      newId: () => 'task_0',
    })
      .handedTo(RunId.of('run_0'), delivery())
      .openedAt(
        RunId.of('run_0'),
        PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
      );
    before.pullEvents();
    const { open, saved } = opening({ wearer: before });

    await open(task());

    expect(saved.map((each) => each.id.value)).toEqual(['task_0', 'task_1']);
    expect(saved[0]?.marks).toEqual([]);
    expect(saved[0]?.pullEvents().map((each) => each.kind)).toEqual([
      'task.mark-taken',
    ]);
  });

  it('answers with the one already open rather than opening another', async () => {
    const already = task().openedAt(
      RUN,
      PullRequestUrl.of('https://github.com/acme/widgets/pull/1'),
    );
    const { open, opened, saved } = opening();

    const answered = await open(already);

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(opened).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('records it on the task as it stands once GitHub answers, not as it was read before', async () => {
    const { open, saved } = opening({
      meanwhile: (task) =>
        task.heard({
          station: StationName.of('Backlog'),
          body: TaskNoteBody.of('One more thing.'),
          at: NOW,
          voice: Voice.world(),
        }),
    });

    await open(task());

    expect(saved[0]?.notes).toHaveLength(1);
    expect(saved[0]?.pullRequest?.value).toBe(
      'https://github.com/acme/widgets/pull/7',
    );
  });

  it('answers with the pull request recorded while GitHub was being asked', async () => {
    const { open, saved } = opening({
      meanwhile: (task) =>
        task.openedAt(
          RUN,
          PullRequestUrl.of('https://github.com/acme/widgets/pull/5'),
        ),
    });

    const answered = await open(task());

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/5');
    expect(saved).toEqual([]);
  });

  it('records nothing for a run the task has let go of', async () => {
    const { open, saved } = opening();

    await expect(open(task(), asking(), RunId.of('run_2'))).rejects.toThrow(
      InvalidTaskTransitionError,
    );
    expect(saved).toEqual([]);
  });
});
