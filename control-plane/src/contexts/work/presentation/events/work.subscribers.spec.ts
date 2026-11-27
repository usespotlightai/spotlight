import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_UPDATED } from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import { RUN_SUSPENDED } from '@shared-kernel/application/integration-events/run-suspended.integration-event';
import { anOutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { requestedBy } from '@work/application/ports/runs.fake-spec';
import { ChatResolved } from '@work/domain/events/chat-resolved.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { describe, expect, it, vi } from 'vitest';

describe('workSubscribers', () => {
  it('reconciles the setup list of the team whose setup chat opened its pull request', async () => {
    const forTeam = vi.fn(async () => undefined);
    const reconciling = workSubscribers({
      setup: { forTeam },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.reconcile-setup-on-pull-request',
    );

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
    const retiring = workSubscribers({
      chatSandbox,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.retire-sandbox-of-resolved-chat',
    );
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

  it('takes up the run a person answered, whichever way the answer came', async () => {
    const answeredRuns = { on: vi.fn(async () => {}) };
    const taking = workSubscribers({
      answeredRuns,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.take-up-the-run-a-person-answered',
    );
    const answered = new TaskAnswered(
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      RunId.of('run_1'),
      null,
    );

    await taking?.handle(answered, anOutboxRecord());

    expect(taking?.kinds).toEqual(['task.answered']);
    expect(taking?.callsOut).toBe(true);
    expect(answeredRuns.on).toHaveBeenCalledWith(answered);
  });

  it('decides the turn of a run that suspended, outside the transaction that suspended it', async () => {
    const turns = { take: vi.fn(async () => {}) };
    const taking = workSubscribers({
      turns,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.take-turn',
    );

    await taking?.handle(
      {
        kind: RUN_SUSPENDED,
        runId: 'run_1',
        workspaceId: 'ws_1',
        requester: requestedBy.task('task_1', 0),
        attempt: 2,
        at: '2026-11-07T10:00:00.000Z',
      } as never,
      anOutboxRecord(),
    );

    expect(taking?.kinds).toEqual(['runs.run-suspended.v1']);
    expect(taking?.callsOut).toBe(true);
    expect(turns.take).toHaveBeenCalledWith(RunId.of('run_1'), 2);
  });

  it('hands each update of a pull request, with its branch and whether it is open, to the task pull requests', async () => {
    const updated = vi.fn(async () => {});
    const tracking = workSubscribers({
      taskPullRequests: { updated },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.track-pull-request-from-task-branch',
    );
    const updateOf = (state: string, branch: string | null) =>
      ({
        kind: PULL_REQUEST_UPDATED,
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/api/pull/8',
        repository: 'acme/api',
        state,
        branch,
      }) as never;

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
    const resolving = workSubscribers({
      setupPullRequests,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.resolve-merged-setup-chat',
    );

    await resolving?.handle(
      {
        kind: PULL_REQUEST_CLOSED,
        workspaceId: 'ws_1',
        pullRequest: 'https://github.com/acme/infra/pull/12',
        repository: 'acme/infra',
        gitHubId: 12,
        closedAt: '2026-11-07T10:00:00.000Z',
        merged: true,
        mergeCommit: 'abc123',
      } as never,
      anOutboxRecord(),
    );

    expect(resolving?.kinds).toEqual([PULL_REQUEST_CLOSED]);
    expect(setupPullRequests.closed).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      PullRequestUrl.of('https://github.com/acme/infra/pull/12'),
      new Date('2026-11-07T10:00:00.000Z'),
      true,
    );
  });
});
