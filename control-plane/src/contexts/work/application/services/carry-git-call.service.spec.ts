import type {
  GitCall,
  RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CarryGitCall } from '@work/application/services/carry-git-call.service';
import { RunWorks } from '@work/application/services/run-works.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const REPLAYED_AS = StationConfig.rehydrate(
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
);

const NOW = new Date('2026-08-30T09:00:00.000Z');

const call: GitCall = {
  method: 'GET',
  path: '/info/refs',
  search: '?service=git-upload-pack',
  headers: {},
  body: null,
};

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
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
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const task = () =>
  Task.rehydrate({ ...added(), currentRunId: RunId.of('run_1') });

const chat = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('dev'),
    repositories: [Repository.of('acme/planning')],
    body: ChatMessageBody.of('Plan the queue.'),
    now: NOW,
    newId: () => 'chat_1',
  });

const lineWorking = (repositories: readonly string[]): Line => {
  const repos = repositories.map((each) => Repository.of(each));

  return { repositories: { all: repos } } as unknown as Line;
};

const COMMIT = 'c'.repeat(40);

const REPLAY = RunSubject.replay(
  RunId.of('run_0'),
  TaskId.of('task_1'),
  StationId.of('station_1'),
  TeamId.of('team_1'),
);

const specFor = (subject: RunSubject) =>
  RunSpec.of({
    command: { executable: 'sh', args: [] },
    briefing: 'do the thing',
    handover: { options: [], noteLimit: 4_000 },
    continuity: { key: 'task:station' },
    ...(subject.isReplay
      ? {
          checkouts: [
            { remote: 'spotlight:repository', path: 'widgets', ref: COMMIT },
          ],
          replay: {
            archive: null,
            checkouts: [
              { path: 'widgets', commit: COMMIT, repository: 'acme/widgets' },
            ],
            movesOnAfter: [],
          },
        }
      : {}),
  });

const enqueued = (
  subject: RunSubject = RunSubject.task(
    TaskId.of('task_1'),
    StationId.of('station_1'),
    TaskRevision.of(0),
  ),
) =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    subject,
    spec: specFor(subject),
    configuredAs: subject.isReplay ? REPLAYED_AS : null,
  });

const claimedBy = (runner: string, subject?: RunSubject) =>
  enqueued(subject).claim(RunnerId.of(runner), NOW);

const carrying = (
  run: Run | null,
  existing: Task | null,
  repositories: readonly string[] = ['acme/widgets'],
  checking = false,
) => {
  const git = {
    call: vi.fn(async () => ({ status: 200, headers: {}, body: null })),
  };

  const service = new CarryGitCall(
    new RunWorks(
      { findById: vi.fn(async () => run) } as unknown as RunRepository,
      { find: vi.fn(async () => existing) } as unknown as TaskRepository,
      { find: vi.fn(async () => chat()) } as unknown as ChatRepository,
      {
        findByStation: vi.fn(async () => lineWorking(repositories)),
      } as unknown as LineRepository,
      { of: async () => null },
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

  it('carries a chat’s call to a repository the chat was given', async () => {
    const { service, git } = carrying(
      claimedBy('runner_1', RunSubject.chat(ChatId.of('chat_1'))),
      null,
    );

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
    const { service, git } = carrying(
      claimedBy('runner_1', RunSubject.chat(ChatId.of('chat_1'))),
      null,
    );

    await expect(
      service.carry('run_1', 'runner_1', 'planning', 'git-receive-pack', call),
    ).resolves.toBeNull();
    expect(git.call).not.toHaveBeenCalled();
  });

  it('carries nothing for a run its task has let go of', async () => {
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
      const { service, git } = carrying(claimedBy('runner_1', REPLAY), null);

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
      const { service, git } = carrying(claimedBy('runner_1', REPLAY), null);

      await expect(
        service.carry('run_1', 'runner_1', 'widgets', 'git-receive-pack', call),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(git.call).not.toHaveBeenCalled();
    });

    it('reaches no repository it does not check out', async () => {
      const { service, git } = carrying(claimedBy('runner_1', REPLAY), null, [
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
        claimedBy('runner_1', REPLAY),
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
        claimedBy('runner_1', REPLAY),
        null,
        undefined,
        true,
      );

      await expect(
        service.carry('run_1', 'runner_2', 'widgets', 'git-receive-pack', call),
      ).rejects.toMatchObject({ kind: 'conflict' });
      expect(git.call).not.toHaveBeenCalled();
    });

    it('reaches no repository the replay did not check out', async () => {
      const { service, git } = carrying(
        claimedBy('runner_1', REPLAY),
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
