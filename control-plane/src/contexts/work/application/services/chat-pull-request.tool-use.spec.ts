import type {
  OpenedPullRequestDto,
  PullRequestPort,
} from '@github/application/ports/pull-request.port';
import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatToolContext } from '@work/application/ports/integration-tools.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { ChatPullRequestToolUse } from '@work/application/services/chat-pull-request.tool-use';
import type { CreateTask } from '@work/application/services/create-task';
import type { PullRequestOpeningHook } from '@work/application/services/pull-request-opening-hook';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { NowhereToOpenAPullRequestError } from '@work/domain/exceptions/nowhere-to-open-a-pull-request.error';
import { PullRequestHookDeniedError } from '@work/domain/exceptions/pull-request-hook-denied.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  repositoryOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const opened = (url: string): OpenedPullRequestDto =>
  partial<OpenedPullRequestDto>({ url });

const taskAnswerOf = (answer: unknown) =>
  z.object({ task: z.string() }).parse(answer);

const NOW = new Date('2026-11-19T09:00:00.000Z');
const URL = 'https://github.com/acme/web/pull/7';
const LEON = UserId.of('user_1');
const SHIP = StationId.of('station_ship');

const INPUT_VALUES = {
  branch: 'feat/video-icons',
  title: 'Show video icons',
  body: 'Videos show the Film icon.',
};
const INPUTS = ToolInputs.of(INPUT_VALUES);

const stationAt = (
  id: string,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const DELIVERY_INPUT: Parameters<typeof lineMapOf>[0] = {
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  repositories: [repositoryOf(Repository.of('acme/web'))],
  stations: [
    stationAt('station_backlog', 'backlog', 0, { kind: 'backlog' }),
    stationAt('station_ship', 'ship', 1, {
      harness: HarnessId.of('dev'),
      tools: [Tool.of('pull-request')],
    }),
    stationAt('station_completed', 'completed', 2, { kind: 'completed' }),
  ],
};

const DELIVERY = lineMapOf(DELIVERY_INPUT);

const using = (
  repositories = [Repository.of('acme/web')],
  lines = [DELIVERY],
  held?: readonly Task[],
) => {
  let chat = Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    repositories,
    body: ChatMessageBody.of('Show icons for videos.'),
    now: NOW,
    newId: () => 'chat_1',
  }).assignRun(RunId.of('run_1'), NOW);
  chat.pullEvents();

  let next = 0;
  const created: Task[] = [];
  const racing: Task[] = [];
  const tasks = new Map<string, Task>(
    (held ?? []).map((each) => [each.id.value, each]),
  );
  const open = vi.fn(() => Promise.resolve(opened(URL)));
  const changedOn = vi.fn((): Promise<readonly string[]> =>
    Promise.resolve(['web/src/icons.ts']),
  );
  const defaultBranchNameOf = vi.fn(() => Promise.resolve('main'));
  const allows = vi.fn(async () => {});
  const allowsNew = vi.fn(async () => {});
  const tool = new ChatPullRequestToolUse(
    partial<ChatRepository>({
      find: () => Promise.resolve(chat),
      save: (saved: Chat) => {
        chat = saved;

        return Promise.resolve();
      },
    }),
    partial<TaskRepository>({
      find: (id: TaskId) => Promise.resolve(tasks.get(id.value) ?? null),
      save: (saved: Task) => {
        tasks.set(saved.id.value, saved);

        return Promise.resolve();
      },
      remove: (gone: Task) => {
        tasks.delete(gone.id.value);

        return Promise.resolve();
      },
      onBranch: (_: WorkspaceId, branch: Branch) =>
        Promise.resolve(
          [...tasks.values()].find((each) => each.branch.equals(branch)) ??
            null,
        ),
    }),
    partial<LineMapsPort>({ ofTeam: () => Promise.resolve(lines) }),
    { placementsAt: () => Promise.resolve([]) },
    partial<WorkAccess>({
      membersOf: () => Promise.resolve(TeamMembers.of([LEON])),
    }),
    partial<CreateTask>({
      create: ({ task }: { task: Task }) => {
        const first = racing.shift();

        if (first) {
          tasks.set(first.id.value, first);
          return Promise.reject(
            new Error('duplicate key value violates unique constraint'),
          );
        }

        created.push(task);
        tasks.set(task.id.value, task);
        return Promise.resolve(task);
      },
    }),
    partial<PullRequestPort>({ open, changedOn }),
    partial<PullRequestOpeningHook>({ allows, allowsNew }),
    partial<TransactionPort>({
      inTransaction: <T>(work: () => Promise<T>) => work(),
    }),
    partial<RepositorySettingsPort>({ defaultBranchNameOf }),
    { generate: () => `id_${++next}` },
    partial<ClockPort>({ now: () => NOW }),
  );
  const context: ChatToolContext = {
    kind: 'chat',
    runId: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    chatId: chat.id,
    teamId: TeamId.of('team_1'),
    requester: null,
  };

  return {
    tool,
    context,
    open,
    changedOn,
    allows,
    allowsNew,
    created,
    stored: (id: string) => tasks.get(id),
    put: (task: Task) => {
      tasks.set(task.id.value, task);
    },
    raceWith: (task: Task) => {
      racing.push(task);
    },
    current: () => chat,
  };
};

describe('ChatPullRequestToolUse', () => {
  it('is the open-pull-request tool', () => {
    expect(using().tool.tool.value).toBe('open-pull-request');
  });

  it('opens the pull request from the branch named, in the chat’s one repository', async () => {
    const { tool, context, open } = using();

    await expect(tool.call(context, INPUTS)).resolves.toMatchObject({
      url: URL,
    });
    expect(open).toHaveBeenCalledWith({
      workspaceId: WorkspaceId.of('ws_1'),
      repository: expect.objectContaining({ value: 'acme/web' }) as unknown,
      branch: 'feat/video-icons',
      base: null,
      title: 'Show video icons',
      body: 'Videos show the Film icon.',
    });
  });

  it('puts a task on hold for the chat at the station that opens pull requests, and keeps it on the chat', async () => {
    const { tool, context, created, stored, current } = using();

    const answer = taskAnswerOf(await tool.call(context, INPUTS));
    const task = firstOf(created);

    expect(task?.stationId.equals(SHIP)).toBe(true);
    expect(task?.openHold?.chat?.value).toBe('chat_1');
    expect(task?.branch.value).toBe('feat/video-icons');
    expect(answer.task).toBe(task?.id.value);
    expect(stored(answer.task)?.pullRequests.map((each) => each.value)).toEqual(
      [URL],
    );
    expect(current().pullRequests.map((each) => each.task.value)).toEqual([
      answer.task,
    ]);
  });

  it('asks the pull-request.opening hook about the new task before it opens the pull request', async () => {
    const { tool, context, allowsNew, open, created } = using();
    allowsNew.mockImplementationOnce(() => {
      expect(open).not.toHaveBeenCalled();
      expect(created).toEqual([]);

      return Promise.resolve();
    });

    await tool.call(context, INPUTS);

    expect(allowsNew).toHaveBeenCalledWith({
      task: expect.objectContaining({
        branch: Branch.of('feat/video-icons'),
      }) as unknown,
      repository: expect.objectContaining({ value: 'acme/web' }) as unknown,
      title: 'Show video icons',
      changed: ['web/src/icons.ts'],
    });
  });

  it('creates no task and opens nothing when the hook denies the pull request', async () => {
    const { tool, context, allowsNew, open, created, current } = using();
    allowsNew.mockRejectedValueOnce(
      new PullRequestHookDeniedError('Name the issue in the title.'),
    );

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      PullRequestHookDeniedError,
    );
    expect(open).not.toHaveBeenCalled();
    expect(created).toEqual([]);
    expect(current().pullRequests).toEqual([]);
  });

  it('asks the hook about the task it already has when it opens a pull request in another repository', async () => {
    const both = lineMapOf({
      ...DELIVERY_INPUT,
      repositories: [
        repositoryOf(Repository.of('acme/web')),
        repositoryOf(Repository.of('acme/api')),
      ],
    });
    const { tool, context, allows, allowsNew, open, created } = using(
      [Repository.of('acme/web'), Repository.of('acme/api')],
      [both],
    );
    open
      .mockResolvedValueOnce(opened(URL))
      .mockResolvedValueOnce(opened('https://github.com/acme/api/pull/3'));

    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/web' }),
    );
    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/api' }),
    );

    expect(allowsNew).toHaveBeenCalledTimes(1);
    expect(allows).toHaveBeenCalledWith({
      task: created[0],
      runId: null,
      repository: expect.objectContaining({ value: 'acme/api' }) as unknown,
      title: 'Show video icons',
    });
  });

  it('creates no task from a branch with no changes', async () => {
    const { tool, context, changedOn, open, created } = using();
    changedOn.mockResolvedValueOnce([]);

    await expect(
      tool.call(context, ToolInputs.of({ branch: 'fix/empty', title: 'Fix' })),
    ).rejects.toThrow(/has no changes from the default branch of acme\/web/);
    expect(created).toEqual([]);
    expect(open).not.toHaveBeenCalled();
  });

  it('creates no task on the default branch, even with a base it differs from', async () => {
    const { tool, context, open, created } = using();

    await expect(
      tool.call(
        context,
        ToolInputs.of({ branch: 'main', base: 'release/1.x', title: 'Fix' }),
      ),
    ).rejects.toThrow(/main is the default branch/);
    expect(created).toEqual([]);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing more on a task when the base named is not the base of the task', async () => {
    const { tool, context, open } = using();

    await tool.call(context, INPUTS);
    await expect(
      tool.call(
        context,
        ToolInputs.of({
          branch: 'feat/video-icons',
          base: 'release/1.x',
          title: 'Show video icons',
        }),
      ),
    ).rejects.toThrow(/starts from the default branch/);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps the chat’s pull request when GitHub names the repository in other letter case', async () => {
    const { tool, context, open, current } = using();
    open.mockResolvedValueOnce(opened('https://github.com/Acme/Web/pull/7'));

    await tool.call(context, INPUTS);

    expect(current().pullRequests.map((each) => each.url.value)).toEqual([
      'https://github.com/Acme/Web/pull/7',
    ]);
  });

  it('keeps the pull request on its task when the person hands the task to the line while GitHub opens it', async () => {
    const both = lineMapOf({
      ...DELIVERY_INPUT,
      repositories: [
        repositoryOf(Repository.of('acme/web')),
        repositoryOf(Repository.of('acme/api')),
      ],
    });
    const { tool, context, open, stored, put, current } = using(
      [Repository.of('acme/web'), Repository.of('acme/api')],
      [both],
    );
    const handedOver = (task: Task) =>
      task.resumeLine({
        by: LEON,
        line: both,
        next: 'continue',
        to: null,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: NOW,
      });
    const first = taskAnswerOf(
      await tool.call(
        context,
        ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/web' }),
      ),
    );
    open.mockImplementationOnce(() => {
      const task = stored(first.task);

      if (task) {
        put(handedOver(task));
      }

      return Promise.resolve(opened('https://github.com/acme/api/pull/3'));
    });

    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/api' }),
    );

    expect(stored(first.task)?.openHold).toBeNull();
    expect(stored(first.task)?.pullRequests.map((each) => each.value)).toEqual([
      URL,
      'https://github.com/acme/api/pull/3',
    ]);
    expect(current().pullRequests).toHaveLength(2);
  });

  it('opens another pull request for the same task from the same branch in a second repository the line works on', async () => {
    const both = lineMapOf({
      ...DELIVERY_INPUT,
      repositories: [
        repositoryOf(Repository.of('acme/web')),
        repositoryOf(Repository.of('acme/api')),
      ],
    });
    const { tool, context, open, created, stored, current } = using(
      [Repository.of('acme/web'), Repository.of('acme/api')],
      [both],
    );
    open
      .mockResolvedValueOnce(opened(URL))
      .mockResolvedValueOnce(opened('https://github.com/acme/api/pull/3'));

    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/web' }),
    );
    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/api' }),
    );

    expect(created).toHaveLength(1);
    expect(
      stored(created[0]?.id.value ?? '')?.pullRequests.map(
        (each) => each.value,
      ),
    ).toEqual([URL, 'https://github.com/acme/api/pull/3']);
    expect(current().pullRequests).toHaveLength(2);
  });

  it('opens nothing more from the branch of a task handed to the line', async () => {
    const { tool, context, open, created, stored, put } = using([
      Repository.of('acme/web'),
      Repository.of('acme/api'),
    ]);

    await tool.call(
      context,
      ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/web' }),
    );
    const task = stored(created[0]?.id.value ?? '');

    if (!task) {
      throw new Error('expected a stored task');
    }

    put(
      task.resumeLine({
        by: LEON,
        line: DELIVERY,
        next: 'continue',
        to: null,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: NOW,
      }),
    );

    await expect(
      tool.call(
        context,
        ToolInputs.of({ ...INPUT_VALUES, repository: 'acme/api' }),
      ),
    ).rejects.toThrow(
      /was handed to the line\. Push the change to a new branch/,
    );
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('answers the pull request already opened from the branch rather than opening another', async () => {
    const { tool, context, open, created } = using();

    await tool.call(context, INPUTS);
    await expect(tool.call(context, INPUTS)).resolves.toMatchObject({
      url: URL,
    });
    expect(open).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
  });

  it('creates no task when GitHub fails, and opens the pull request on a new try', async () => {
    const { tool, context, open, created, stored } = using();
    open.mockRejectedValueOnce(new Error('GitHub is down.'));

    await expect(tool.call(context, INPUTS)).rejects.toThrow('GitHub is down.');
    expect(created).toEqual([]);

    const answer = taskAnswerOf(await tool.call(context, INPUTS));

    expect(open).toHaveBeenCalledTimes(2);
    expect(created).toHaveLength(1);
    expect(stored(answer.task)?.pullRequests.map((each) => each.value)).toEqual(
      [URL],
    );
  });

  it('opens the pull request on the task of a call that created it at the same time', async () => {
    const { tool, context, raceWith, created, stored } = using();
    const first = Task.openedInChat({
      defaultBranch: Branch.of('main'),
      line: DELIVERY,
      at: SHIP,
      title: TaskTitle.of('Show video icons'),
      description: null,
      branch: Branch.of('feat/video-icons'),
      rank: TaskRank.of('i'),
      by: LEON,
      members: TeamMembers.of([LEON]),
      chat: ChatId.of('chat_1'),
      hold: HoldId.of('hold_first'),
      now: NOW,
      newId: () => 'task_first',
    });
    raceWith(first);

    const answer = taskAnswerOf(await tool.call(context, INPUTS));

    expect(answer.task).toBe('task_first');
    expect(created).toEqual([]);
    expect(
      stored('task_first')?.pullRequests.map((each) => each.value),
    ).toEqual([URL]);
  });

  it('answers no pull request it opened once the task was handed to the line', async () => {
    const { tool, context, created, stored, put } = using();

    await tool.call(context, INPUTS);
    const task = stored(created[0]?.id.value ?? '');

    if (!task) {
      throw new Error('expected a stored task');
    }

    put(
      task.resumeLine({
        by: LEON,
        line: DELIVERY,
        next: 'continue',
        to: null,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: NOW,
      }),
    );

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      /was handed to the line\. Push the change to a new branch/,
    );
  });

  it('opens nothing from a branch that belongs to another task', async () => {
    const theirs = Task.openedInChat({
      defaultBranch: Branch.of('main'),
      line: DELIVERY,
      at: SHIP,
      title: TaskTitle.of('Someone else’s'),
      description: null,
      branch: Branch.of('feat/video-icons'),
      rank: TaskRank.of('i'),
      by: LEON,
      members: TeamMembers.of([LEON]),
      chat: ChatId.of('chat_2'),
      hold: HoldId.of('hold_2'),
      now: NOW,
      newId: () => 'task_theirs',
    });
    const { tool, context, open, created } = using(
      [Repository.of('acme/web')],
      [DELIVERY],
      [theirs],
    );

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      /belongs to another task/,
    );
    expect(open).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('asks which repository when the chat has more than one', async () => {
    const { tool, context, open } = using([
      Repository.of('acme/web'),
      Repository.of('acme/api'),
    ]);

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      /Name the repository of the change with --repository/,
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing where no line holds the pull request', async () => {
    const { tool, context, open } = using([Repository.of('acme/web')], []);

    await expect(tool.call(context, INPUTS)).rejects.toThrow(
      NowhereToOpenAPullRequestError,
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('opens nothing for a run that no longer works the chat', async () => {
    const { tool, context, open } = using();

    await expect(
      tool.call({ ...context, runId: RunId.of('run_2') }, INPUTS),
    ).rejects.toThrow(InvalidChatTransitionError);
    expect(open).not.toHaveBeenCalled();
  });
});
