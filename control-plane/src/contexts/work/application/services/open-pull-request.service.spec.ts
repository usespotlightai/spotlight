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
import type {
  HookedTaskDto,
  HookedTasksPort,
} from '@work/application/ports/hooked-tasks.port';
import type {
  BeforeMoment,
  HookVerdict,
} from '@work/application/ports/lifecycle-hooks.port';
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
import { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const RUN = RunId.of('run_1');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
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
        id: StationId.of(backlogId),
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
  }).assignRun(RUN, delivery());
  added.pullEvents();

  return added;
};

const lineWorking = (repositories: readonly string[]): Line => {
  const repositoriesOfLine = LineRepositories.of(
    repositories.map((each) => WorkedRepository.of(Repository.of(each))),
  );

  return {
    opening: (name: string | null) => repositoriesOfLine.opening(name),
  } as unknown as Line;
};

const requested = (repository: string | null = null, body = '') => ({
  title: 'Fix the queue',
  body,
  repository,
});

const opening = (
  over: {
    connected?: boolean;
    repositories?: readonly string[];
    markedTask?: Task;
    meanwhile?: (task: Task) => Task;
    verdict?: HookVerdict;
    hooked?: boolean;
    listening?: boolean;
  } = {},
) => {
  const saved: Task[] = [];
  const hookCalls: BeforeMoment[] = [];
  const compared: unknown[][] = [];
  const listened: [string, string][] = [];
  let stored: Task | null = null;
  const opened: Parameters<PullRequestPort['open']>[0][] = [];

  const pullRequests = {
    open: async (request: Parameters<PullRequestPort['open']>[0]) => {
      if (over.connected === false) {
        throw new NoGitHubInstallationError();
      }
      opened.push(request);
      if (stored && over.meanwhile) {
        stored = over.meanwhile(stored);
      }
      return { url: 'https://github.com/acme/widgets/pull/7' };
    },
    changedOn: async (...on: unknown[]) => {
      compared.push(on);
      return ['db/migrations/0042_add_index.sql', 'src/queue.ts'];
    },
  } as unknown as PullRequestPort;
  const tasks = {
    find: async () => stored,
    findByMarks: async () => over.markedTask ?? null,
    save: async (each: Task) => {
      saved.push(each);
    },
  } as unknown as TaskRepository;
  const line = lineWorking(over.repositories ?? ['acme/widgets']);
  const service = new OpenPullRequest(
    tasks,
    { findByStation: async () => line } as unknown as LineRepository,
    pullRequests,
    { inTransaction: (work) => work() } satisfies TransactionPort,
    {
      of: async (taskId: string, runId: string | null) =>
        over.hooked === false
          ? null
          : ({ taskId, runId, teamId: 'team_1' } as unknown as HookedTaskDto),
    } as unknown as HookedTasksPort,
    {
      listens: async (teamId, on) => {
        listened.push([teamId, on]);
        return over.listening ?? true;
      },
      before: async (_task, moment) => {
        hookCalls.push(moment);
        return over.verdict ?? { kind: 'allowed' };
      },
      after: async () => {},
    },
    { now: () => NOW, sleep: async () => {} },
  );

  return {
    open: (task: Task, input = requested(), runId = RUN) => {
      stored = task;
      return service.open(
        { runId, taskId: task.id, stationId: task.stationId },
        input,
      );
    },
    opened,
    saved,
    hookCalls,
    compared,
    listened,
  };
};

describe('OpenPullRequest', () => {
  it('opens one against the line’s only repository, for the task’s branch', async () => {
    const { open, opened } = opening();

    const answered = await open(task(), requested(null, 'why'));

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

    await open(task(), requested('web'));

    expect(opened[0]?.repository).toEqual(Repository.of('acme/web'));
  });

  it('rejects where several are worked and the agent named none', async () => {
    const { open, opened } = opening({
      repositories: ['acme/api', 'acme/web'],
    });

    await expect(open(task())).rejects.toThrow(/Please name one/);
    expect(opened).toEqual([]);
  });

  it('rejects a repository the line does not work', async () => {
    const { open, opened } = opening({ repositories: ['acme/api'] });

    await expect(open(task(), requested('web'))).rejects.toThrow(
      /no repository named web/,
    );
    expect(opened).toEqual([]);
  });

  it('rejects where the line works no repository', async () => {
    const { open, opened } = opening({ repositories: [] });

    await expect(open(task())).rejects.toThrow(/no repository/);
    expect(opened).toEqual([]);
  });

  it('rejects where the workspace has no GitHub installation', async () => {
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
      .assignRun(RunId.of('run_0'), delivery())
      .recordPullRequest(
        RunId.of('run_0'),
        PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
        NOW,
        delivery(),
      );
    before.pullEvents();
    const { open, saved } = opening({ markedTask: before });

    await open(task());

    expect(saved.map((each) => each.id.value)).toEqual(['task_0', 'task_1']);
    expect(saved[0]?.marks).toEqual([]);
    expect(saved[0]?.pullEvents().map((each) => each.kind)).toEqual([
      'task.mark-taken',
    ]);
  });

  it('answers with the one already open rather than opening another', async () => {
    const already = task().recordPullRequest(
      RUN,
      PullRequestUrl.of('https://github.com/acme/widgets/pull/1'),
      NOW,
      delivery(),
    );
    const { open, opened, saved } = opening();

    const answered = await open(already);

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/1');
    expect(opened).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('records it on the task as it is when GitHub answers, not as it was read before', async () => {
    const { open, saved } = opening({
      meanwhile: (task) =>
        task.addMessage({
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

  it('answers with the pull request recorded while GitHub was being called', async () => {
    const { open, saved } = opening({
      meanwhile: (task) =>
        task.recordPullRequest(
          RUN,
          PullRequestUrl.of('https://github.com/acme/widgets/pull/5'),
          NOW,
          delivery(),
        ),
    });

    const answered = await open(task());

    expect(answered.url).toBe('https://github.com/acme/widgets/pull/5');
    expect(saved).toEqual([]);
  });

  it('records nothing for a run the task detached', async () => {
    const { open, saved } = opening();

    await expect(open(task(), requested(), RunId.of('run_2'))).rejects.toThrow(
      InvalidTaskTransitionError,
    );
    expect(saved).toEqual([]);
  });

  describe('hooks', () => {
    it('calls the hooks before it opens one, with what the branch changes', async () => {
      const { open, hookCalls, compared } = opening();

      await open(task());

      expect(compared).toEqual([
        [
          WorkspaceId.of('ws_1'),
          Repository.of('acme/widgets'),
          'spotlight/task_1',
        ],
      ]);
      expect(hookCalls).toEqual([
        {
          on: 'pull-request.opening',
          repository: 'acme/widgets',
          branch: 'spotlight/task_1',
          title: 'Fix the queue',
          changed: ['db/migrations/0042_add_index.sql', 'src/queue.ts'],
        },
      ]);
    });

    it('opens nothing and tells the agent why when a hook denies it', async () => {
      const { open, opened, saved } = opening({
        verdict: {
          kind: 'denied',
          reason:
            'The hook core/dba-review denied the pull request: migrations need a DBA.',
        },
      });

      await expect(open(task())).rejects.toThrow(
        'A hook stopped the pull request. No pull request was opened. The hook core/dba-review denied the pull request: migrations need a DBA.',
      );
      expect(opened).toEqual([]);
      expect(saved).toEqual([]);
    });

    it('calls no hooks for a task that already has one', async () => {
      const { open, hookCalls } = opening();

      await open(
        task().recordPullRequest(
          RUN,
          PullRequestUrl.of('https://github.com/acme/widgets/pull/3'),
          NOW,
          delivery(),
        ),
      );

      expect(hookCalls).toEqual([]);
    });

    it('compares nothing where no hook can learn of the task', async () => {
      const { open, compared, opened } = opening({ hooked: false });

      await open(task());

      expect(compared).toEqual([]);
      expect(opened).toHaveLength(1);
    });

    it('calls neither GitHub nor a hook when none listens for a pull request opening', async () => {
      const { open, compared, hookCalls, listened, opened } = opening({
        listening: false,
      });

      await open(task());

      expect(listened).toEqual([['team_1', 'pull-request.opening']]);
      expect(compared).toEqual([]);
      expect(hookCalls).toEqual([]);
      expect(opened).toHaveLength(1);
    });
  });
});
