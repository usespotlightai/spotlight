import type {
  GitCall,
  RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import {
  aChatDispatch,
  aRunFor,
  aTaskDispatch,
  dispatchesOf,
  type RunRequested,
  runWorksOver,
} from '@work/application/services/run-works.fake-spec';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-30T09:00:00.000Z');

const call: GitCall = {
  method: 'GET',
  path: '/info/refs',
  search: '?service=git-upload-pack',
  headers: {},
  body: null,
};

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
        kind: 'completed',
      }),
    ],
  });

const added = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.between(null, null),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const task = () =>
  Task.rehydrate({ ...added(), currentRunId: RunId.of('run_1') });

const chat = () =>
  Chat.start({
    lines: [],
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    repositories: [Repository.of('acme/planning')],
    body: ChatMessageBody.of('Plan the queue.'),
    now: NOW,
    newId: () => 'chat_1',
  });

const lineWorking = (repositories: readonly string[]): LineMap => {
  const repos = repositories.map((each) => Repository.of(each));

  return { repositories: { all: repos } } as unknown as LineMap;
};

interface Claimed {
  readonly run: Run;
  readonly requested: RunRequested;
}

const RUN = RunId.of('run_1');

const enqueued = (requested: RunRequested = 'task'): Claimed => ({
  run: aRunFor(RUN, 'dev', requested),
  requested,
});

const claimedBy = (
  runner: string,
  requested: RunRequested = 'task',
): Claimed => {
  const { run } = enqueued(requested);

  return { run: run.claim(RunnerId.of(runner), NOW), requested };
};

const TRIAL = Dispatch.trialOrdered({
  order: DispatchOrder.of({}),
  id: RUN,
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: null,
  subject: {
    kind: 'trial',
    basedOn: RunId.of('run_0'),
    taskId: TaskId.of('task_1'),
    stationId: StationId.of('station_1'),
    asOf: NOW,
    repositories: [{ path: 'widgets', repository: 'acme/widgets' }],
    followUp: null,
  },
  configuredAs: StationConfig.rehydrate(
    {
      prompt: null,
      harness: 'dev',
      model: null,
      effort: null,
      profile: null,
      image: null,
      repositories: [],
      skills: [],
      tools: [],
      decisions: false,
      memories: false,
    },
    'f'.repeat(64),
  ),
  now: NOW,
});

const dispatchOf = (requested: RunRequested) => {
  switch (requested) {
    case 'task':
      return aTaskDispatch(RUN, TaskId.of('task_1'), StationId.of('station_1'));
    case 'chat':
      return aChatDispatch(RUN, ChatId.of('chat_1'));
    case 'trial':
      return TRIAL;
    default:
      return null;
  }
};

const carrying = (
  claimed: Claimed | null,
  existing: Task | null,
  repositories: readonly string[] = ['acme/widgets'],
  checking = false,
) => {
  const git = {
    call: vi.fn(async () => ({ status: 200, headers: {}, body: null })),
  };

  const service = new CarryGitCall(
    runWorksOver(
      {
        findById: vi.fn(async () => claimed?.run ?? null),
      } as unknown as RunRepository,
      { find: vi.fn(async () => existing) } as unknown as TaskRepository,
      { find: vi.fn(async () => chat()) } as unknown as ChatRepository,
      {
        findByStation: vi.fn(async () => lineWorking(repositories)),
      } as unknown as LineMapsPort,
      dispatchesOf(
        ...[claimed && dispatchOf(claimed.requested)].filter(
          (each): each is Dispatch => Boolean(each),
        ),
      ),
      { now: () => new Date(), sleep: async () => {} },
    ),
    {
      isConnected: vi.fn(async () => true),
    } as unknown as WorkspaceConnectionsPort,
    git as unknown as RepositoryGitPort,
    { isCheckOfRunLeasedBy: vi.fn(async () => checking) },
    { now: () => NOW, sleep: async () => {} },
  );

  return { service, git };
};

describe('CarryGitCall', () => {
  it('carries the call to the line’s repository named at the door', async () => {
    const { service, git } = carrying(claimedBy('runner_1'), task());

    await service.carry(
      'run_1',
      'runner_1',
      'widgets',
      'git-upload-pack',
      call,
    );

    expect(git.call).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      Repository.of('acme/widgets'),
      call,
    );
  });

  it('carries a chat’s call to a repository of the chat', async () => {
    const { service, git } = carrying(claimedBy('runner_1', 'chat'), null);

    await service.carry(
      'run_1',
      'runner_1',
      'planning',
      'git-upload-pack',
      call,
    );

    expect(git.call).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      Repository.of('acme/planning'),
      call,
    );
  });

  it('carries no push from a chat that sets nothing up', async () => {
    const { service, git } = carrying(claimedBy('runner_1', 'chat'), null);

    await expect(
      service.carry('run_1', 'runner_1', 'planning', 'git-receive-pack', call),
    ).resolves.toBeNull();
    expect(git.call).not.toHaveBeenCalled();
  });

  it('carries nothing for a run its task detached', async () => {
    const { service, git } = carrying(claimedBy('runner_1'), added());

    await expect(
      service.carry('run_1', 'runner_1', 'widgets', 'git-upload-pack', call),
    ).resolves.toBeNull();
    expect(git.call).not.toHaveBeenCalled();
  });

  it('rejects a runner that does not lease the run', async () => {
    const { service, git } = carrying(claimedBy('runner_1'), task());

    await expect(
      service.carry('run_1', 'runner_2', 'widgets', 'git-upload-pack', call),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(git.call).not.toHaveBeenCalled();
  });

  it('rejects a run nobody leases', async () => {
    const { service, git } = carrying(enqueued(), task());

    await expect(
      service.carry('run_1', 'runner_1', 'widgets', 'git-upload-pack', call),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect(git.call).not.toHaveBeenCalled();
  });

  it('says nothing to carry where the line does not work that repository', async () => {
    const { service, git } = carrying(claimedBy('runner_1'), task());

    await expect(
      service.carry('run_1', 'runner_1', 'other', 'git-upload-pack', call),
    ).resolves.toBeNull();
    expect(git.call).not.toHaveBeenCalled();
  });

  it('rejects a run that does not exist', async () => {
    const { service } = carrying(null, null);

    await expect(
      service.carry('run_1', 'runner_1', 'widgets', 'git-upload-pack', call),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  describe('a replay', () => {
    it('fetches the repositories it checks out', async () => {
      const { service, git } = carrying(claimedBy('runner_1', 'trial'), null);

      await service.carry(
        'run_1',
        'runner_1',
        'widgets',
        'git-upload-pack',
        call,
      );

      expect(git.call).toHaveBeenCalledWith(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/widgets'),
        call,
      );
    });

    it('is never let near a push', async () => {
      const { service, git } = carrying(claimedBy('runner_1', 'trial'), null);

      await expect(
        service.carry('run_1', 'runner_1', 'widgets', 'git-receive-pack', call),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(git.call).not.toHaveBeenCalled();
    });

    it('allows no repository it does not check out', async () => {
      const { service, git } = carrying(claimedBy('runner_1', 'trial'), null, [
        'acme/widgets',
        'acme/gadgets',
      ]);

      await expect(
        service.carry('run_1', 'runner_1', 'gadgets', 'git-upload-pack', call),
      ).resolves.toBeNull();
      expect(git.call).not.toHaveBeenCalled();
    });
  });

  describe('a runner that leases a check of the run', () => {
    it('reads the repository though it never leased the run', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1'),
        task(),
        undefined,
        true,
      );

      await service.carry(
        'run_1',
        'runner_2',
        'widgets',
        'git-upload-pack',
        call,
      );

      expect(git.call).toHaveBeenCalledWith(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/widgets'),
        call,
      );
    });

    it('reads it even once the task has moved on', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1'),
        added(),
        undefined,
        true,
      );

      await service.carry(
        'run_1',
        'runner_2',
        'widgets',
        'git-upload-pack',
        call,
      );

      expect(git.call).toHaveBeenCalled();
    });

    it('is never let near a push', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1'),
        task(),
        undefined,
        true,
      );

      await expect(
        service.carry('run_1', 'runner_2', 'widgets', 'git-receive-pack', call),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(git.call).not.toHaveBeenCalled();
    });

    it('says nothing to carry where the line does not work that repository', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1'),
        task(),
        undefined,
        true,
      );

      await expect(
        service.carry('run_1', 'runner_2', 'other', 'git-upload-pack', call),
      ).resolves.toBeNull();
      expect(git.call).not.toHaveBeenCalled();
    });
  });

  describe('a runner that leases a check of a replay', () => {
    it('reads the repository the replay checked out, though its line no longer works it', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1', 'trial'),
        null,
        [],
        true,
      );

      await service.carry(
        'run_1',
        'runner_2',
        'widgets',
        'git-upload-pack',
        call,
      );

      expect(git.call).toHaveBeenCalledWith(
        WorkspaceId.of('ws_1'),
        Repository.of('acme/widgets'),
        call,
      );
    });

    it('is never let near a push', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1', 'trial'),
        null,
        undefined,
        true,
      );

      await expect(
        service.carry('run_1', 'runner_2', 'widgets', 'git-receive-pack', call),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(git.call).not.toHaveBeenCalled();
    });

    it('allows no repository the replay did not check out', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1', 'trial'),
        null,
        ['acme/widgets', 'acme/gadgets'],
        true,
      );

      await expect(
        service.carry('run_1', 'runner_2', 'gadgets', 'git-upload-pack', call),
      ).resolves.toBeNull();
      expect(git.call).not.toHaveBeenCalled();
    });
  });
});
