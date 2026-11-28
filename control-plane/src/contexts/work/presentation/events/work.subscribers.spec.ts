import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_UPDATED,
  type PullRequestUpdatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import {
  RUN_SUSPENDED,
  type RunSuspendedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-suspended.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { requestedBy } from '@work/application/ports/runs.fake-spec';
import { ChatResolved } from '@work/domain/events/chat-resolved.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskCompleted } from '@work/domain/events/task-completed.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { describe, expect, it, vi } from 'vitest';

type Reactions = Parameters<typeof workSubscribers>[0];

describe('workSubscribers', () => {
  it('reconciles the setup list of the team whose setup chat opened its pull request', async () => {
    const forTeam = vi.fn(async () => undefined);
    const reconciling = workSubscribers(
      partial<Reactions>({
        setup: partial<Reactions['setup']>({ forTeam }),
      }),
    ).find((each) => each.name === 'work.reconcile-setup-on-pull-request');

    await reconciling?.handle(
      new SetupPullRequestOpened(
        ChatId.of('chat_1'),
        WorkspaceId.of('ws_1'),
        UserId.of('user_1'),
        TeamId.of('team_1'),
        PullRequestUrl.of('https://github.com/acme/infra/pull/12'),
        new Date('2026-10-11T09:00:00.000Z'),
      ),
      anOutboxRecord(),
    );

    expect(reconciling?.kinds).toEqual(['chat.setup-pull-request-opened']);
    expect(forTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
  });

  it('retires the sandbox of a chat when it is resolved, when its run ends and when it is deleted', async () => {
    const chatSandbox = { on: vi.fn(async () => {}) };
    const retiring = workSubscribers(
      partial<Reactions>({
        chatSandbox: partial<Reactions['chatSandbox']>(chatSandbox),
      }),
    ).find((each) => each.name === 'work.retire-sandbox-of-resolved-chat');
    const resolved = new ChatResolved(
      ChatId.of('chat_1'),
      WorkspaceId.of('ws_1'),
      UserId.of('user_1'),
      new Date('2026-11-26T10:00:00.000Z'),
    );

    await retiring?.handle(resolved, anOutboxRecord());

    expect(retiring?.kinds).toEqual([
      'chat.resolved',
      'chat.run-ended',
      'chat.deleted',
    ]);
    expect(chatSandbox.on).toHaveBeenCalledWith(resolved);
  });

  it('starts the tasks blocked by a task when it is completed, and not when it only finished at the end of its line', async () => {
    const onCompleted = vi.fn(async () => undefined);
    const subscribers = workSubscribers(
      partial<Reactions>({
        blockedTasks: partial<Reactions['blockedTasks']>({ onCompleted }),
      }),
    );
    const starting = subscribers.find(
      (each) => each.name === 'work.start-tasks-blocked-by-completed-task',
    );
    const completed = new TaskCompleted(
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      StationId.of('station_completed'),
      new Date('2026-11-28T09:00:00.000Z'),
    );

    await starting?.handle(completed, anOutboxRecord());

    expect(starting?.kinds).toEqual(['task.completed']);
    expect(onCompleted).toHaveBeenCalledWith(completed);
    expect(
      subscribers
        .filter((each) => each.kinds.includes('task.finished'))
        .map((each) => each.name)
        .filter((name) => name.includes('blocked')),
    ).toEqual([]);
  });

  it('takes up the run a person answered, whichever way the answer came', async () => {
    const on = vi.fn(async () => {});
    const taking = workSubscribers(
      partial<Reactions>({
        answeredRuns: partial<Reactions['answeredRuns']>({ on }),
      }),
    ).find((each) => each.name === 'work.take-up-the-run-a-person-answered');
    const answered = new TaskAnswered(
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      RunId.of('run_1'),
      null,
    );

    await taking?.handle(answered, anOutboxRecord());

    expect(taking?.kinds).toEqual(['task.answered']);
    expect(taking?.callsOut).toBe(true);
    expect(on).toHaveBeenCalledWith(answered);
  });

  it('decides the turn of a run that suspended, outside the transaction that suspended it', async () => {
    const take = vi.fn(async () => {});
    const taking = workSubscribers(
      partial<Reactions>({
        turns: partial<Reactions['turns']>({ take }),
      }),
    ).find((each) => each.name === 'work.take-turn');
    const suspended: RunSuspendedIntegrationEvent = {
      kind: RUN_SUSPENDED,
      runId: 'run_1',
      workspaceId: 'ws_1',
      requester: requestedBy.task('task_1', 0),
      attempt: 2,
      at: '2026-11-07T10:00:00.000Z',
    };

    await taking?.handle(suspended, anOutboxRecord());

    expect(taking?.kinds).toEqual(['runs.run-suspended.v1']);
    expect(taking?.callsOut).toBe(true);
    expect(take).toHaveBeenCalledWith(RunId.of('run_1'), 2);
  });

  it('hands each update of a pull request, with its branch and whether it is open, to the task pull requests', async () => {
    const updated = vi.fn(async () => {});
    const tracking = workSubscribers(
      partial<Reactions>({
        taskPullRequests: partial<Reactions['taskPullRequests']>({ updated }),
      }),
    ).find((each) => each.name === 'work.track-pull-request-from-task-branch');
    const updateOf = (
      state: PullRequestUpdatedIntegrationEvent['state'],
      branch: string | null,
    ) =>
      partial<PullRequestUpdatedIntegrationEvent>({
        kind: PULL_REQUEST_UPDATED,
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/8',
        repository: 'acme/api',
        state,
        branch,
      });

    await tracking?.handle(
      updateOf('open', 'feat/retry-uploads-1a2b3c4d'),
      anOutboxRecord(),
    );
    await tracking?.handle(
      updateOf('closed', 'feat/retry-uploads-1a2b3c4d'),
      anOutboxRecord(),
    );
    await tracking?.handle(updateOf('open', null), anOutboxRecord());

    const url = PullRequestUrl.of('https://github.com/acme/api/pull/8');

    expect(tracking?.kinds).toEqual([PULL_REQUEST_UPDATED]);
    expect(updated.mock.calls).toEqual([
      [
        WorkspaceId.of('ws_1'),
        { url, open: true },
        'feat/retry-uploads-1a2b3c4d',
      ],
      [
        WorkspaceId.of('ws_1'),
        { url, open: false },
        'feat/retry-uploads-1a2b3c4d',
      ],
      [WorkspaceId.of('ws_1'), { url, open: true }, null],
    ]);
  });

  it('tells the setup chats of the workspace that a pull request closed', async () => {
    const setupPullRequests = { closed: vi.fn(async () => {}) };
    const resolving = workSubscribers(
      partial<Reactions>({
        setupPullRequests:
          partial<Reactions['setupPullRequests']>(setupPullRequests),
      }),
    ).find((each) => each.name === 'work.resolve-merged-setup-chat');
    const closed: PullRequestClosedIntegrationEvent = {
      kind: PULL_REQUEST_CLOSED,
      workspaceId: 'ws_1',
      pullRequest: 'https://github.com/acme/infra/pull/12',
      repository: 'acme/infra',
      gitHubId: 12,
      closedAt: '2026-11-07T10:00:00.000Z',
      merged: true,
      mergeCommit: 'abc123',
    };

    await resolving?.handle(closed, anOutboxRecord());

    expect(resolving?.kinds).toEqual([PULL_REQUEST_CLOSED]);
    expect(setupPullRequests.closed).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      PullRequestUrl.of('https://github.com/acme/infra/pull/12'),
      new Date('2026-11-07T10:00:00.000Z'),
      true,
    );
  });
});
